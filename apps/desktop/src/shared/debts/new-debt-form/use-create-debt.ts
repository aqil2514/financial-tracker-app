"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { newDebtSchema, type NewDebtFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Jalan pintas untuk mencatat piutang/utang baru langsung dari halaman
 * `/debts`, tanpa lewat form transaksi lengkap. Dua mode (field
 * `record_mode`, lihat schema.ts):
 *
 * - `'transfer'` (jalur lama): membuat 1 transaksi transfer biasa
 *   (kas<->debt) lalu memicu `applyDebtTransaction` yang sama persis
 *   dengan jalur form transaksi (lihat "Tambah Utang/Piutang Baru dari
 *   halaman /debts" di debt-receivable-tracking.md). Arah transfer
 *   ditentukan dari `debt_type`, jadi TIDAK ambigu — tidak butuh
 *   `DebtActionField`.
 * - `'direct'`: TIDAK menyentuh saldo akun KAS (uang sudah berpindah DI
 *   LUAR app — pinjam tunai, barter, piutang lama), TAPI tetap WAJIB
 *   membuat 1 transaksi penutup `income`/`expense` langsung pada akun
 *   `debt_account_id` itu sendiri — pola identik `useWriteOffDebt`
 *   (lihat use-write-off-debt.ts). Sesuai
 *   docs/concept/konsep-transaksi.md: saldo akun HANYA bisa berubah
 *   lewat `transactions`, jadi "piutang/utang baru" = nilai baru yang
 *   "dipegang" akun debt itu, WAJIB transaksi — regresi awal (insert
 *   `debts` dengan `transaction_id` NULL tanpa transaksi apa pun,
 *   ditemukan 2026-10-04) sudah diperbaiki di sini, lihat
 *   migrations/0033_backfill_direct_debt_transactions.sql untuk
 *   backfill baris lama yang terlanjur dibuat sebelum fix ini.
 *   Arah tanda (lihat konsep-utang-piutang.md "kas->debt = makin
 *   positif"): `receivable` butuh +amount pada akun debt -> `income`.
 *   `payable` butuh -amount -> `expense`. Lihat
 *   docs/todos/plan/debts-sync-and-non-transfer-debts.md.
 */
export function useCreateDebt() {
  return useEntityForm({
    schema: newDebtSchema,
    defaultValues: () => ({
      debt_type: "receivable" as const,
      record_mode: "transfer" as const,
      contact_name: null,
      amount: 0,
      cash_account_id: null,
      debt_account_id: null,
      date: now(),
      note: "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: NewDebtFormOutput) => {
      const contactId = await resolveContactId(values.contact_name);
      const db = await getDb();

      if (values.record_mode === "direct") {
        // Sudah divalidasi wajib terisi oleh schema.ts (refine kedua,
        // berlaku utk semua record_mode).
        const debtAccountId = values.debt_account_id as string;

        // Transaksi penutup pada akun debt itu sendiri — TIDAK menyentuh
        // akun kas manapun (uangnya memang berpindah di luar app), tapi
        // saldo akun debt WAJIB ikut berubah (lihat komentar fungsi ini
        // di atas). Pola identik useWriteOffDebt, arah tanda dibalik
        // (write-off membawa ke NOL, ini MENCIPTAKAN piutang/utang baru).
        const transactionId = newId();
        const transactionType = values.debt_type === "receivable" ? "income" : "expense";
        await db.execute(
          `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
           VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, $6, $7)`,
          [transactionId, transactionType, values.amount, debtAccountId, values.note, values.date, contactId]
        );

        const debtId = newId();
        await db.execute(
          `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            debtId,
            values.debt_type,
            contactId,
            values.amount,
            debtAccountId,
            transactionId,
            values.date,
            values.note,
          ]
        );
        void pushOnWrite("transactions", transactionId);
        void pushOnWrite("debts", debtId);
        return debtId;
      }

      // Sudah divalidasi wajib terisi oleh schema.ts untuk record_mode === 'transfer'.
      const cashAccountId = values.cash_account_id as string;
      const debtAccountId = values.debt_account_id as string;

      // receivable: kas -> debt. payable: debt -> kas.
      const accountId = values.debt_type === "receivable" ? cashAccountId : debtAccountId;
      const transferAccountId =
        values.debt_type === "receivable" ? debtAccountId : cashAccountId;
      const transactionId = newId();

      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6, $7)`,
        [transactionId, values.amount, accountId, transferAccountId, values.note, values.date, contactId]
      );

      const touchedDebtRows = await applyDebtTransaction({
        db,
        transactionId,
        type: "transfer",
        accountId,
        transferAccountId,
        contactId,
        amount: values.amount,
        date: values.date,
        // debt_type === 'payable' berarti arah transfer adalah
        // debt->kas, yang ambigu di applyDebtTransaction tanpa
        // debtAction eksplisit — form ini SELALU berarti "utang baru",
        // tidak pernah pelunasan (itu tugas form "Catat Pembayaran"
        // yang terpisah), jadi dipaksa 'payable' di sini.
        debtAction: values.debt_type === "payable" ? "payable" : null,
        settleDebtIds: [],
      });

      void pushOnWrite("transactions", transactionId);
      for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
      for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);

      return transactionId;
    },
    // Kedua mode SELALU bikin 1 baris `transactions` (direct: transaksi
    // penutup pada akun debt; transfer: transaksi transfer kas<->debt)
    // -- invalidate domain "transactions" juga supaya saldo akun/laporan
    // turunannya ikut ter-refresh, bukan cuma domain "debts" murni.
    invalidateKey: dependentKeysOf("transactions", "debts"),
    successMessage: "Utang/piutang baru berhasil dicatat",
    errorMessage: "Gagal mencatat utang/piutang baru",
  });
}
