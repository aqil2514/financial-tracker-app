import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getDb, type Transaction } from "@/lib/db";

export function useAccountMonthTransactions(accountId: number, month: Date) {
  const monthKey = format(month, "yyyy-MM");

  return useQuery({
    queryKey: ["accounts", "month-transactions", accountId, monthKey],
    queryFn: async () => {
      const db = await getDb();
      return db.select<Transaction[]>(
        `SELECT * FROM transactions
         WHERE (account_id = $1 OR transfer_account_id = $1)
           AND strftime('%Y-%m', date) = $2
         ORDER BY date DESC, id DESC`,
        [accountId, monthKey]
      );
    },
  });
}
