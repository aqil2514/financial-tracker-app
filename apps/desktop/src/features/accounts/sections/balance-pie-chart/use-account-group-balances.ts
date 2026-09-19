import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type AccountGroupBalanceRow = {
  name: string;
  balance: number;
};

export const accountGroupBalancesQueryKey = ["accounts", "group-balances"];

const UNGROUPED_LABEL = "Tanpa Grup";

export function useAccountGroupBalances() {
  return useQuery({
    queryKey: accountGroupBalancesQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<AccountGroupBalanceRow[]>(
        `SELECT COALESCE(g.name, '${UNGROUPED_LABEL}') as name,
           SUM(
             a.initial_balance
               + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'income'), 0)
               - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'expense'), 0)
               - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'transfer'), 0)
               + COALESCE((SELECT SUM(amount) FROM transactions WHERE transfer_account_id = a.id AND type = 'transfer'), 0)
           ) as balance
         FROM accounts a
         LEFT JOIN account_groups g ON g.id = a.group_id
         GROUP BY COALESCE(g.id, -1)
         ORDER BY balance DESC`
      );
    },
  });
}
