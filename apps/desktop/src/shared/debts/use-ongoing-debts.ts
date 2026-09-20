import { useQuery } from "@tanstack/react-query";
import { getDb, type Debt } from "@/lib/db";

export const ongoingDebtsQueryKey = ["debts", "ongoing"];

export type OngoingDebt = Debt & { remaining: number };

/**
 * Piutang (`type='receivable'`) milik satu kontak, dipakai untuk
 * multi-select "Pelunasan piutang yang sudah ada" di form transaksi.
 * `remaining` = `amount - SUM(debt_payments.amount)`, diurut dari `date`
 * TERLAMA dulu supaya alokasi FIFO tinggal iterasi urutan ini.
 *
 * Filter normalnya `status='ongoing'` — TAPI kalau `excludeDebtId`
 * diisi (dipakai form EDIT untuk transaksi berperan `role: 'payment'`,
 * lihat use-transaction-debt-status.ts), piutang itu SELALU disertakan
 * apa pun statusnya, dan `remaining`-nya dihitung TANPA
 * `debt_payments` dari `excludeTransactionId` (pembayaran milik
 * transaksi yang sedang diedit itu sendiri, yang baru akan
 * dihapus/direcreate SETELAH submit, bukan saat form dibuka).
 *
 * Tanpa ini, edit transaksi yang MELUNASI PENUH sebuah piutang (jadi
 * `status='paid'`) akan membuat piutang itu hilang dari checklist saat
 * user ganti field berbahaya dan pilih ulang "Pelunasan" — padahal
 * secara logic piutang itu justru yang SEHARUSNYA bisa dipilih ulang
 * (lihat "Edit transaksi yang sudah py debts terkait" di
 * debt-receivable-tracking.md).
 */
export function useOngoingDebts(
  contactId: number | null,
  options: { excludeDebtId?: number; excludeTransactionId?: number } = {}
) {
  const { excludeDebtId, excludeTransactionId } = options;

  return useQuery({
    queryKey: [...ongoingDebtsQueryKey, contactId, excludeDebtId, excludeTransactionId],
    queryFn: async (): Promise<OngoingDebt[]> => {
      const db = await getDb();
      return db.select<OngoingDebt[]>(
        `SELECT
           debts.*,
           debts.amount - COALESCE(
             (SELECT SUM(amount) FROM debt_payments
              WHERE debt_payments.debt_id = debts.id
                AND ($3 IS NULL OR debt_payments.transaction_id IS NOT $3)),
             0
           ) AS remaining
         FROM debts
         WHERE debts.contact_id = $1
           AND debts.type = 'receivable'
           AND (debts.status = 'ongoing' OR debts.id = $2)
         ORDER BY debts.date ASC, debts.id ASC`,
        [contactId, excludeDebtId ?? null, excludeTransactionId ?? null]
      );
    },
    enabled: contactId != null,
  });
}
