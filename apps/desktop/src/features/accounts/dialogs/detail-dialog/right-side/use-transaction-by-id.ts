import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";

export function useTransactionById(transactionId: number | null) {
  return useQuery({
    queryKey: ["accounts", "transaction-detail", transactionId],
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<Transaction[]>(
        "SELECT * FROM transactions WHERE id = $1",
        [transactionId]
      );
      return rows[0] ?? null;
    },
    enabled: transactionId != null,
  });
}
