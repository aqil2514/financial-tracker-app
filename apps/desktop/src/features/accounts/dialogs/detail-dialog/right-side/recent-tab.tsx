"use client";

import { useAccountTransactions } from "./use-account-transactions";
import { TransactionList } from "./transaction-list";

export function RecentTab({ accountId }: { accountId: number }) {
  const { data: transactions } = useAccountTransactions(accountId);
  return <TransactionList transactions={transactions} accountId={accountId} />;
}
