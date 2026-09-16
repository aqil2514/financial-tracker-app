import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";

export const transactionsQueryKey = ["transactions"];

export function useTransactions() {
  return useQuery({
    queryKey: transactionsQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<Transaction[]>(
        "SELECT * FROM transactions ORDER BY date DESC, id DESC"
      );
    },
  });
}
