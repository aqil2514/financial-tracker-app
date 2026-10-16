import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export const debtAccountUsageQueryKey = ["debts", "account-usage"];

export type DebtAccountUsage = {
  account_id: string;
  type: "receivable" | "payable";
  n: number;
};

/**
 * Histori pemakaian tiap akun `account_type='debt'` per arah (`debts.type`)
 * — satu akun debt BOLEH dipakai utk dua arah sekaligus (akun generik spt
 * "Keluarga"/"Orang Lain", lihat docs/concept/konsep-tipe-akun.md), jadi ini
 * BUKAN constraint, cuma sinyal "akun ini BIASANYA dipakai utk arah apa" —
 * dipakai `new-debt-form.tsx` utk prefill & warning non-blocking, supaya
 * entri baru tidak diam-diam ter-prefill ke akun yang secara histori untuk
 * arah berlawanan (lihat docs/dogfooding/2026-10-16-form-utang-piutang-
 * dropdown-akun-debt-tidak-difilter-per-jenis.md).
 */
export function useDebtAccountUsage() {
  return useQuery({
    queryKey: debtAccountUsageQueryKey,
    queryFn: async (): Promise<DebtAccountUsage[]> => {
      const db = await getDb();
      return db.select<DebtAccountUsage[]>(
        `SELECT account_id, type, COUNT(*) as n
         FROM debts
         WHERE deleted_at IS NULL AND account_id IS NOT NULL
         GROUP BY account_id, type`
      );
    },
  });
}
