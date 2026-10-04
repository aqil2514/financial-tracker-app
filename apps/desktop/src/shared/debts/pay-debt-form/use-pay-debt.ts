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
 *    berpindah LEWAT AKUN KAS. 'non_cash' (barter/pemutihan/offset,
 *    disimplifikasi jadi SATU jalur, lihat
 *    docs/todos/plan/debts-sync-and-non-transfer-debts.md): TIDAK ADA
 *    akun kas yang terlibat, TAPI (REVISI — lihat "Bug ditemukan &
 *    diperbaiki" di debt-receivable-tracking.md, sama akar masalah
 *    dengan `use-write-off-debt.ts`) TETAP membuat 1 transaksi
 *    `expense`(receivable)/`income`(payable) LANGSUNG pada
 *    `debt.account_id` sebagai transaksi "penutup" — BUKAN
 *    `transaction_id: NULL` seperti sebelumnya. Alasannya:
 *    `docs/concept/konsep-utang-piutang.md` ("baik piutang maupun utang
 *    sama-sama mengarah ke nol saat diselesaikan") TIDAK mengecualikan
 *    penyelesaian non-cash — `accounts.balance` SELALU hasil agregasi
 *    `transactions` (bukan kolom tersimpan, lihat use-accounts.ts),
 *    jadi `debt_payments` dengan `transaction_id: NULL` membuat
 *    `debts.remaining` jadi 0 TAPI saldo akun `debt` tetap nyangkut
 *    selamanya — bug yang sama persis dengan write-off sebelum
 *    diperbaiki. Alasan (diikhlaskan/barter/dst) tetap di `note`, tidak
 *    ada status terpisah dari `'paid'`.
 * 2. `debt.account_id` — relevan utk KEDUA `settlement_mode`. Sejak
 *    migrasi 0031, `debts.account_id` manual SELALU terisi (mode
 *    'transfer' maupun 'direct' sama-sama wajib akun bertipe 'debt',
 *    lihat new-debt-form/schema.ts) — NULL cuma tersisa utk baris dari
 *    sync Retailku (`source = 'retailku_sync'`, keputusan terpisah,
 *    lihat audit-kepatuhan-konsep-tipe-akun.md pertanyaan #2):
 *    - **Ada `account_id`**, `cash`: membuat 1 transaksi transfer
 *      debt->kas lalu reuse `applyDebtTransaction` dengan
 *      `debtAction: 'settlement'` (jalur FIFO yang sudah ada, walau di
 *      sini kandidatnya cuma 1 debt).
 *    - **Ada `account_id`**, `non_cash`: transaksi `expense`/`income`
 *      penutup LANGSUNG pada `debt.account_id` (lihat poin 1) +
 *      `debt_payments` dengan `transaction_id` menunjuk transaksi itu.
 *    - **`account_id` NULL** (data sync Retailku), `cash`: TIDAK ADA
 *      akun debt yang bisa jadi sisi transfer. Uang pelunasan tetap
 *      riil masuk/keluar akun kas, jadi dicatat sbg transaksi income
 *      (receivable)/expense (payable) BIASA (bukan transfer), lalu
 *      `debt_payments` di-insert LANGSUNG (bukan lewat
 *      `applyDebtTransaction`/FIFO — kandidatnya sudah pasti cuma
 *      `debt.id` ini).
 *    - **`account_id` NULL**, `non_cash`: TIDAK ADA akun debt yang bisa
 *      dibuatkan transaksi penutup — tetap `transaction_id: NULL`
 *      seperti semula (satu-satunya sisa kasus satu ini, bukan
 *      perilaku default lagi), sama keputusan dengan write-off utk
 *      baris Retailku (butuh tindak lanjut terpisah).
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
        // debt.account_id (akun bertipe 'debt') tetap jadi tumpuan
        // pembayaran — lihat docs/concept/konsep-tipe-akun.md. Bisa
        // NULL kalau debt ini dari sync Retailku (lihat komentar di
        // atas use-pay-debt.ts) — SATU-SATUNYA kasus tanpa transaksi
        // penutup, karena tidak ada akun debt yang bisa dituju.
        if (debt.account_id == null) {
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

        // Transaksi "penutup" LANGSUNG pada akun debt itu sendiri —
        // TIDAK ada uang riil berpindah ke akun kas mana pun, tapi
        // tetap WAJIB lewat transactions (satu-satunya jalur sah
        // mengubah accounts.balance, lihat use-accounts.ts) supaya
        // saldo akun debt ikut mengarah ke nol seperti pelunasan cash.
        const transactionId = newId();
        const transactionType = debt.type === "receivable" ? "expense" : "income";

        await db.execute(
          `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
           VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, $6, $7)`,
          [
            transactionId,
            transactionType,
            values.amount,
            debt.account_id,
            values.note,
            values.date,
            debt.contact_id,
          ]
        );

        await db.execute(
          `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [newId(), debt.id, values.amount, debt.account_id, transactionId, values.date, values.note]
        );

        if (values.amount >= debt.remaining) {
          await db.execute("UPDATE debts SET status = 'paid' WHERE id = $1", [debt.id]);
        }

        return transactionId;
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
