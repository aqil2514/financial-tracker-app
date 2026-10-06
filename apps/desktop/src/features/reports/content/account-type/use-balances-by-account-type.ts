import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import type { AccountType } from "@/lib/account-types";

export type AccountTypeBalanceRow = {
  account_type: AccountType;
  total: number;
  /** Cuma terisi untuk account_type 'investment' -- SUM
   * `current_market_value` dari `investment_accounts` lintas akun aktif
   * tipe ini. NULL untuk tipe lain. Dipakai untuk baris tambahan
   * "Unrealized P/L" di kartu breakdown (lihat index.tsx) -- TIDAK pernah
   * ikut ke `total`/pie chart (prinsip: agregat kekayaan tetap berbasis
   * modal/balance, lihat docs/concept/konsep-investasi.md). */
  total_market_value: number | null;
};

export const balancesByAccountTypeQueryKey = ["reports", "balances-by-account-type"];

export function useBalancesByAccountType() {
  return useQuery({
    queryKey: balancesByAccountTypeQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<AccountTypeBalanceRow[]>(
        `SELECT a.account_type as account_type,
           SUM(
             a.initial_balance
               + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'income'), 0)
               - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'expense'), 0)
               - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'transfer'), 0)
               + COALESCE((SELECT SUM(amount) FROM transactions WHERE transfer_account_id = a.id AND type = 'transfer'), 0)
           ) as total,
           CASE WHEN a.account_type = 'investment'
             THEN SUM(COALESCE((SELECT ia.current_market_value FROM investment_accounts ia WHERE ia.account_id = a.id), 0))
             ELSE NULL
           END as total_market_value
         FROM accounts a
         WHERE a.is_active = 1
         GROUP BY a.account_type
         ORDER BY total DESC`
      );
    },
  });
}
