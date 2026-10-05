import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import type { AccountType } from "@/lib/account-types";

export type AccountTypeBalanceRow = {
  account_type: AccountType;
  total: number;
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
           ) as total
         FROM accounts a
         WHERE a.is_active = 1
         GROUP BY a.account_type
         ORDER BY total DESC`
      );
    },
  });
}
