import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type ForexAccountDetail = {
  country: string;
  currency: string;
  current_rate: number;
  updated_at: string;
} | null;

// Base key didaftarkan di QUERY_DEPENDENCIES.accounts supaya ikut di-invalidate
// saat use-update-account.ts menulis forex_accounts (pola investmentAccountQueryKey).
export const forexAccountQueryKey = ["forex_accounts"];

/** Baris `forex_accounts` (1:1 dengan `accounts`) untuk prefill form edit akun valas. */
export function useForexAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: [...forexAccountQueryKey, accountId],
    queryFn: async (): Promise<ForexAccountDetail> => {
      const db = await getDb();
      const rows = await db.select<
        { country: string; currency: string; current_rate: number; updated_at: string }[]
      >(
        "SELECT country, currency, current_rate, updated_at FROM forex_accounts WHERE account_id = $1",
        [accountId]
      );
      return rows[0] ?? null;
    },
    enabled: accountId != null,
  });
}
