import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import {
  buildRunningBalanceQuery,
  type TransactionWithRunningBalance,
} from "./running-balance-query";

export function useAccountTransactions(accountId: number, limit: number = 10) {
  return useQuery({
    queryKey: ["accounts", "recent-transactions", accountId, limit],
    queryFn: async () => {
      const db = await getDb();
      return db.select<TransactionWithRunningBalance[]>(
        buildRunningBalanceQuery({ limitClause: "LIMIT $2" }),
        [accountId, limit]
      );
    },
  });
}
