import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";

export const recentTransactionsQueryKey = ["dashboard", "recent-transactions"];

export function useRecentTransactions(limit: number = 5) {
  return useQuery({
    queryKey: [...recentTransactionsQueryKey, limit],
    queryFn: async () => {
      const db = await getDb();
      return db.select<Transaction[]>(
        "SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT $1",
        [limit]
      );
    },
  });
}
