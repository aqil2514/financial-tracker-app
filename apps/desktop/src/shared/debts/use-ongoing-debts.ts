import { useQuery } from "@tanstack/react-query";
import { getDb, type Debt } from "@/lib/db";
import { remainingDebtSql } from "./remaining-debt-sql";

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
 *
 * `excludePrincipalDebtId` beda arah dari `excludeDebtId` di atas (yang
 * MEMASUKKAN kembali piutang `paid`) — ini BENAR-BENAR mengeluarkan satu
 * id dari daftar. Dipakai saat transaksi yang sedang diedit sendiri
 * berperan `role: 'principal'` (dia SUMBER piutang itu, bukan pelunasan)
 * — piutang miliknya sendiri tidak boleh muncul sebagai pilihan
 * "Pelunasan", karena baris itu akan DIHAPUS oleh proses edit yang sama
 * sebelum alokasi FIFO sempat jalan (gagal senyap kalau tetap dipilih,
 * lihat applyDebtTransactionEdit).
 */
export function useOngoingDebts(
  contactId: string | null,
  options: { excludeDebtId?: string; excludeTransactionId?: string; excludePrincipalDebtId?: string } = {}
) {
  const { excludeDebtId, excludeTransactionId, excludePrincipalDebtId } = options;

  return useQuery({
    queryKey: [...ongoingDebtsQueryKey, contactId, excludeDebtId, excludeTransactionId, excludePrincipalDebtId],
    queryFn: async (): Promise<OngoingDebt[]> => {
      const db = await getDb();
      return db.select<OngoingDebt[]>(
        `SELECT
           debts.*,
           ${remainingDebtSql({ excludeTransactionIdParam: "$3" })} AS remaining
         FROM debts
         WHERE debts.contact_id = $1
           AND debts.type = 'receivable'
           AND debts.deleted_at IS NULL
           AND (debts.status = 'ongoing' OR debts.id = $2)
           AND ($4 IS NULL OR debts.id IS NOT $4)
         ORDER BY debts.date ASC, debts.id ASC`,
        [contactId, excludeDebtId ?? null, excludeTransactionId ?? null, excludePrincipalDebtId ?? null]
      );
    },
    enabled: contactId != null,
  });
}
