import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getDb } from "@/lib/db";
import {
  buildRunningBalanceQuery,
  type TransactionWithRunningBalance,
} from "./running-balance-query";

export function useAccountMonthTransactions(accountId: number, month: Date) {
  const monthKey = format(month, "yyyy-MM");

  return useQuery({
    queryKey: ["accounts", "month-transactions", accountId, monthKey],
    queryFn: async () => {
      const db = await getDb();
      return db.select<TransactionWithRunningBalance[]>(
        buildRunningBalanceQuery({ extraWhere: "WHERE strftime('%Y-%m', date) = $2" }),
        [accountId, monthKey]
      );
    },
  });
}
