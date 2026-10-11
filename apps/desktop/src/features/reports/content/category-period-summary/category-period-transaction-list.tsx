"use client";

import { useMemo } from "react";

import { QueryState } from "@/components/query-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccounts, useCategories } from "@/hooks/resources";
import { formatDate } from "@/lib/format-date";
import { CategoryPeriodTransactionRow } from "./category-period-transaction-row";
import { useCategoryPeriodTransactions } from "./use-category-period-transactions";

export function CategoryPeriodTransactionList({ periodId }: { periodId: string }) {
  const { data: transactions, isLoading, error } = useCategoryPeriodTransactions(periodId);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const transactionsByDay = useMemo(() => {
    if (!transactions) return [];
    const groups = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const dateOnly = tx.date.slice(0, 10);
      const existing = groups.get(dateOnly);
      if (existing) existing.push(tx);
      else groups.set(dateOnly, [tx]);
    }
    return Array.from(groups.entries()).map(([date, txs]) => ({
      date,
      displayDate: formatDate(date, "date-only"),
      transactions: txs,
    }));
  }, [transactions]);

  return (
    <div className="space-y-2">
      <QueryState isLoading={isLoading} error={error} />

      {transactions && transactions.length === 0 && (
        <p className="text-muted-foreground text-sm">Tidak ada transaksi.</p>
      )}

      {transactionsByDay.length > 0 && (
        <ScrollArea className="h-96">
          <div className="space-y-4 pr-4">
            {transactionsByDay.map((group) => (
              <div key={group.date}>
                <p className="text-muted-foreground sticky top-0 bg-popover py-1 text-xs font-medium">
                  {group.displayDate}
                </p>
                <div className="divide-y">
                  {group.transactions.map((tx) => (
                    <CategoryPeriodTransactionRow
                      key={tx.id}
                      tx={tx}
                      accounts={accounts}
                      categories={categories}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
