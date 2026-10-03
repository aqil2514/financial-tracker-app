"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import type { DebtListRow } from "@/shared/debts/use-debts-list";
import { payDebtSchema, type PayDebtFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Jalan pintas "Bayar" per baris di /debts/receivables dan /payables —
 * beda dari "Tambah Utang/Piutang Baru" (new-debt-form), form ini SELALU
 * menargetkan SATU `debts.id` spesifik yang sudah diketahui dari baris
 * yang diklik, jadi tidak perlu kontak/checklist multi-pilih.
 *
 * Dua sumbu independen yang menentukan jalur:
 *
 * 1. `settlement_mode` ('cash'/'non_cash') — apakah ada uang yang
 *    berpindah sama sekali. 'non_cash' (barter/pemutihan/offset,
 *    disimplifikasi jadi SATU jalur, lihat
 *    docs/todos/plan/debts-sync-and-non-transfer-debts.md): TIDAK ADA
 *    transaksi/akun kas yang terlibat — `debt_payments` di-insert
 *    LANGSUNG dengan `account_id`/`transaction_id` NULL. Alasan
 *    (diikhlaskan/barter/dst) cukup di `note`, tidak ada status
 *    terpisah dari `'paid'`.
 * 2. `debt.account_id` (NULL = piutang/utang dicatat mode 'direct',
 *    lihat new-debt-form/schema.ts) — HANYA relevan kalau
 *    `settlement_mode === 'cash'`:
 *    - **Ada `account_id`** (mode 'transfer', jalur lama): membuat 1
 *      transaksi transfer debt->kas lalu reuse `applyDebtTransaction`
 *      dengan `debtAction: 'settlement'` (jalur FIFO yang sudah ada,
 *      walau di sini kandidatnya cuma 1 debt).
 *    - **`account_id` NULL**: TIDAK ADA akun debt virtual yang bisa
 *      jadi sisi transfer — bukan bug, piutang ini memang dicatat
 *      tanpa transaksi sejak awal. Uang pelunasan tetap riil
 *      masuk/keluar akun kas, jadi dicatat sbg transaksi income
 *      (receivable)/expense (payable) BIASA (bukan transfer), lalu
 *      `debt_payments` di-insert LANGSUNG (bukan lewat
 *      `applyDebtTransaction`/FIFO — kandidatnya sudah pasti cuma
 *      `debt.id` ini).
 */
export function usePayDebt(debt: DebtListRow, onSuccess?: () => void) {
  return useEntityForm({
    schema: payDebtSchema,
    defaultValues: () => ({
      settlement_mode: "cash" as const,
      amount: debt.remaining,
      cash_account_id: null,
      date: now(),
      note: "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: PayDebtFormOutput) => {
      const db = await getDb();

      if (values.settlement_mode === "non_cash") {
        await db.execute(
          `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date, note)
           VALUES ($1, $2, $3, NULL, NULL, $4, $5)`,
          [newId(), debt.id, values.amount, values.date, values.note]
        );

        if (values.amount >= debt.remaining) {
          await db.execute("UPDATE debts SET status = 'paid' WHERE id = $1", [debt.id]);
        }

        return null;
      }

      // Sudah divalidasi wajib terisi oleh schema.ts untuk settlement_mode === 'cash'.
      const cashAccountId = values.cash_account_id as string;
      const transactionId = newId();

      if (debt.account_id == null) {
        const transactionType = debt.type === "receivable" ? "income" : "expense";
        await db.execute(
          `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
           VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, $6, $7)`,
          [transactionId, transactionType, values.amount, cashAccountId, values.note, values.date, debt.contact_id]
        );

        await db.execute(
          `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId(), debt.id, values.amount, cashAccountId, transactionId, values.date]
        );

        if (values.amount >= debt.remaining) {
          await db.execute("UPDATE debts SET status = 'paid' WHERE id = $1", [debt.id]);
        }

        return transactionId;
      }

      // debt.account_id adalah akun `debt` milik baris ini — arah
      // transfer SELALU debt -> kas untuk pelunasan, apa pun type-nya
      // (receivable maupun payable, keduanya dilunasi dengan arah yang
      // sama: uang keluar dari akun debt virtual ke akun kas nyata).
      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6, $7)`,
        [transactionId, values.amount, debt.account_id, cashAccountId, values.note, values.date, debt.contact_id]
      );

      await applyDebtTransaction({
        db,
        transactionId,
        type: "transfer",
        accountId: debt.account_id,
        transferAccountId: cashAccountId,
        contactId: debt.contact_id,
        amount: values.amount,
        date: values.date,
        debtAction: "settlement",
        settleDebtIds: [debt.id],
      });

      return transactionId;
    },
    invalidateKey: QUERY_DEPENDENCIES.debts,
    successMessage: "Pembayaran berhasil dicatat",
    errorMessage: "Gagal mencatat pembayaran",
    onSuccess,
  });
}
