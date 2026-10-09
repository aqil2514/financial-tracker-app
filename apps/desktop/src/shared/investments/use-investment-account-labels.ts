import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type InvestmentAccountLabelRow = { account_id: string; name: string };

export const investmentAccountLabelsQueryKey = ["investment-account-labels"];

/** Semua pasangan (account_id, nama label) aktif utk SEMUA akun
 * investment sekaligus -- scope 'account' (jenis instrumen, lihat
 * docs/todos/plan/general-label.md), BUKAN label efektif transaksi
 * (beda scope, beda tabel: account_labels bukan transaction_labels/
 * category_labels). 1 akun BISA muncul di >1 baris kalau py >1 label
 * sekaligus (keputusan 2026-10-10: nilai akun dihitung PENUH di setiap
 * label yang dimilikinya saat agregasi, bukan dipecah/dibagi -- overlap
 * disengaja, lihat use-investment-label-breakdown.ts). Dipakai bareng
 * oleh badge di kartu akun DAN agregasi P/L per label, satu query
 * dipakai ulang (bukan 2 query terpisah). */
export function useInvestmentAccountLabels() {
  return useQuery({
    queryKey: investmentAccountLabelsQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<InvestmentAccountLabelRow[]>(
        `SELECT al.account_id as account_id, l.name as name
         FROM account_labels al
         JOIN labels l ON l.id = al.label_id
         WHERE al.deleted_at IS NULL AND l.deleted_at IS NULL
         ORDER BY l.name COLLATE NOCASE`
      );
    },
  });
}
