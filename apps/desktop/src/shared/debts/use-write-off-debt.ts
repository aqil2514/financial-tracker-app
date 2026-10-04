"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import type { DebtListRow } from "./use-debts-list";

/**
 * Tandai piutang/utang `status='written_off'` — kasus "dihapuskan" yang
 * BUKAN pelunasan penuh (mis. diikhlaskan), lihat "Status 'lunas'" di
 * docs/todos/plan/debt-receivable-tracking.md.
 *
 * Sesuai docs/concept/konsep-utang-piutang.md ("baik piutang maupun
 * utang sama-sama mengarah ke nol saat diselesaikan") — write-off TETAP
 * membawa saldo akun `debt` ke nol, PERSIS seperti pelunasan, hanya
 * beda sumber uangnya: bukan transfer dari akun kas, melainkan
 * transaksi `expense` (receivable)/`income` (payable) LANGSUNG pada
 * akun `debt` itu sendiri — konsisten dengan `correctAccountBalance`
 * yang juga mencatat penyesuaian saldo (bukan uang riil berpindah saat
 * itu) sebagai transaksi `income`/`expense` biasa, bukan `UPDATE
 * accounts` langsung (saldo akun di sini SELALU hasil agregasi dari
 * `transactions`, bukan kolom tersimpan — lihat use-accounts.ts). 1
 * baris `debt_payments` dibuat sebesar sisa, `transaction_id` menunjuk
 * transaksi penutup ini, supaya `remaining` (amount - SUM(debt_payments))
 * otomatis jadi 0 — sama pola dengan pelunasan penuh biasa.
 */
export function useWriteOffDebt() {
  return useDbMutation<DebtListRow, void>({
    mutationFn: async (debt) => {
      if (debt.account_id == null) {
        throw new Error(
          "Piutang/utang dari sinkronisasi Retailku belum bisa dihapuskan dari sini."
        );
      }
      if (debt.remaining <= 0) return;

      const db = await getDb();
      const transactionId = newId();
      const transactionType = debt.type === "receivable" ? "expense" : "income";

      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, datetime('now'), $6)`,
        [
          transactionId,
          transactionType,
          debt.remaining,
          debt.account_id,
          "Penutup piutang/utang dihapuskan",
          debt.contact_id,
        ]
      );

      await db.execute(
        `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date)
         VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
        [newId(), debt.id, debt.remaining, debt.account_id, transactionId]
      );

      await db.execute("UPDATE debts SET status = 'written_off' WHERE id = $1", [debt.id]);
    },
    invalidateKey: QUERY_DEPENDENCIES.debts,
    successMessage: "Ditandai sebagai dihapuskan",
    errorMessage: "Gagal menandai dihapuskan",
  });
}
