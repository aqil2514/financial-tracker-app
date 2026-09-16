import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";
import { toPagination } from "@/lib/pagination";

export const transactionsQueryKey = ["transactions"];

export function useTransactions(page: number, limit: number) {
  return useQuery({
    queryKey: [...transactionsQueryKey, page, limit],
    queryFn: async () => {
      const db = await getDb();
      const offset = (page - 1) * limit;

      const [rows, countResult] = await Promise.all([
        db.select<Transaction[]>(
          "SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT $1 OFFSET $2",
          [limit, offset]
        ),
        db.select<{ total: number }[]>(
          "SELECT COUNT(*) as total FROM transactions"
        ),
      ]);

      return {
        transactions: rows,
        pagination: toPagination(countResult[0]?.total ?? 0, page, limit),
      };
    },
  });
}
