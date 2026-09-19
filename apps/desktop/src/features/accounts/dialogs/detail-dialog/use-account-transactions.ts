import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";

export function useAccountTransactions(accountId: number, limit: number = 10) {
  return useQuery({
    queryKey: ["accounts", "recent-transactions", accountId, limit],
    queryFn: async () => {
      const db = await getDb();
      return db.select<Transaction[]>(
        `SELECT * FROM transactions
         WHERE account_id = $1 OR transfer_account_id = $1
         ORDER BY date DESC, id DESC
         LIMIT $2`,
        [accountId, limit]
      );
    },
  });
}
