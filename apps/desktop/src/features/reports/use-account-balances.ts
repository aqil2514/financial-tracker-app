import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type AccountBalanceRow = {
  name: string;
  balance: number;
};

export const accountBalancesQueryKey = ["reports", "account-balances"];

export function useAccountBalances() {
  return useQuery({
    queryKey: accountBalancesQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<AccountBalanceRow[]>(
        `SELECT a.name as name,
           a.initial_balance
             + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'income'), 0)
             - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'expense'), 0)
             - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'transfer'), 0)
             + COALESCE((SELECT SUM(amount) FROM transactions WHERE transfer_account_id = a.id AND type = 'transfer'), 0)
             as balance
         FROM accounts a
         ORDER BY balance DESC`
      );
    },
  });
}
