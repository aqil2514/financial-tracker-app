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
 * yang diklik, jadi tidak perlu kontak/checklist multi-pilih. Di
 * baliknya tetap membuat 1 transaksi transfer debt->kas lalu reuse
 * `applyDebtTransaction` dengan `debtAction: 'settlement'` (jalur FIFO
 * yang sudah ada, walau di sini kandidatnya cuma 1 debt) — lihat "Tambah
 * Utang/Piutang Baru dari halaman /debts" di debt-receivable-tracking.md.
 */
export function usePayDebt(debt: DebtListRow, onSuccess?: () => void) {
  return useEntityForm({
    schema: payDebtSchema,
    defaultValues: () => ({
      amount: debt.remaining,
      cash_account_id: "",
      date: now(),
      note: "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: PayDebtFormOutput) => {
      const db = await getDb();
      const cashAccountId = values.cash_account_id;
      const transactionId = newId();

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
        accountId: debt.account_id ?? "",
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
