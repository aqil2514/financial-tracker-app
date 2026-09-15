import { useQuery } from "@tanstack/react-query";
import { getDb, type Account, type Transaction } from "@/lib/db";
import { withBalances, type AccountWithBalance } from "./calculate-balance";

export const accountsQueryKey = ["accounts-with-balance"];

export type { AccountWithBalance };

export function useAccounts() {
  return useQuery({
    queryKey: accountsQueryKey,
    queryFn: async (): Promise<AccountWithBalance[]> => {
      const db = await getDb();
      const accounts = await db.select<Account[]>(
        "SELECT * FROM accounts ORDER BY id"
      );
      const transactions = await db.select<Transaction[]>(
        "SELECT * FROM transactions"
      );

      return withBalances(accounts, transactions);
    },
  });
}
