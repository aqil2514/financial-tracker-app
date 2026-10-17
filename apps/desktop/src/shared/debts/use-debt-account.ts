import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type DebtAccountDetail = {
  direction: "receivable" | "payable";
} | null;

// Base key (tanpa accountId) -- didaftarkan di QUERY_DEPENDENCIES
// supaya ikut di-invalidate begitu use-update-account.ts menulis ke
// debt_accounts. Pola sama investmentAccountQueryKey.
export const debtAccountQueryKey = ["debt_accounts"];

/**
 * Baris `debt_accounts` (1:1 dengan `accounts`) untuk prefill
 * `debt_direction` saat edit akun debt -- lihat use-update-account.ts.
 */
export function useDebtAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: [...debtAccountQueryKey, accountId],
    queryFn: async (): Promise<DebtAccountDetail> => {
      const db = await getDb();
      const rows = await db.select<{ direction: "receivable" | "payable" }[]>(
        "SELECT direction FROM debt_accounts WHERE account_id = $1",
        [accountId]
      );
      return rows[0] ?? null;
    },
    enabled: accountId != null,
  });
}
