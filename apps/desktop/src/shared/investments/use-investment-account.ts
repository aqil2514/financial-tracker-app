import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type InvestmentAccountDetail = { unit_label: string; current_price_per_unit: number } | null;

// Base key (tanpa accountId) -- didaftarkan di QUERY_DEPENDENCIES
// (lib/query-dependencies.ts) supaya ikut di-invalidate begitu
// use-update-account.ts menulis ke investment_accounts. invalidateQueries
// mencocokkan berdasar PREFIX, jadi key ini otomatis mencakup semua
// turunannya (mis. [...investmentAccountQueryKey, accountId] di bawah).
export const investmentAccountQueryKey = ["investment_accounts"];

/**
 * Baris `investment_accounts` (1:1 dengan `accounts`) untuk prefill
 * `unit_label`/`current_price_per_unit` saat edit akun investasi — lihat
 * use-update-account.ts. `defaultValues` di useEntityForm sinkron (tidak
 * bisa await query), jadi data ini WAJIB sudah termuat lewat hook di
 * caller sebelum form di-render, pola sama `useTransactionInvestmentPurchase`.
 */
export function useInvestmentAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: [...investmentAccountQueryKey, accountId],
    queryFn: async (): Promise<InvestmentAccountDetail> => {
      const db = await getDb();
      const rows = await db.select<{ unit_label: string; current_price_per_unit: number }[]>(
        "SELECT unit_label, current_price_per_unit FROM investment_accounts WHERE account_id = $1",
        [accountId]
      );
      return rows[0] ?? null;
    },
    enabled: accountId != null,
  });
}
