"use client";

import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QueryState } from "@/components/query-state";
import { useAccounts, useCategories } from "@/hooks/resources";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { CashflowChildrenFilter } from "./cashflow-children-filter";
import { CashflowTransactionRow } from "./cashflow-transaction-row";
import { CashflowTransactionsDailyChart } from "./cashflow-transactions-daily-chart";
import type { CashflowGroupBy } from "./use-cashflow-breakdown";
import { useCashflowTransactions } from "./use-cashflow-transactions";

export type CashflowDrillDownTarget = {
  type: "income" | "expense";
  groupBy: CashflowGroupBy;
  groupKey: string | null;
  label: string;
};

const CHART_COLOR: Record<"income" | "expense", string> = {
  income: "#16a34a",
  expense: "#dc2626",
};

export function CashflowTransactionsDialog({
  target,
  from,
  to,
  onOpenChange,
}: {
  target: CashflowDrillDownTarget | null;
  from: string;
  to: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [childId, setChildId] = useState<string | null>(null);

  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const { data: allTransactions, isLoading, error } = useCashflowTransactions(
    from,
    to,
    target?.type ?? "expense",
    target?.groupBy ?? "account_group",
    target?.groupKey ?? null
  );

  // Breakdown per anak (akun dalam grup akun, atau kategori anak dalam
  // kategori induk) dihitung dari SELURUH transaksi grup induk --
  // TIDAK ikut berubah saat childId difilter, supaya list kanan atas
  // selalu menampilkan total masing-masing anak.
  const childRows = useMemo(() => {
    if (!target || !allTransactions) return [];

    if (target.groupBy === "account_group") {
      const childAccounts = (accounts ?? []).filter((a) => a.group_id === target.groupKey);
      return childAccounts
        .map((a) => ({
          value: a.id,
          label: a.name,
          total: allTransactions
            .filter((t) => t.account_id === a.id)
            .reduce((sum, t) => sum + t.amount, 0),
        }))
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total);
    }

    const childCategories = (categories ?? []).filter((c) => c.parent_id === target.groupKey);
    return childCategories
      .map((c) => ({
        value: c.id,
        label: c.name,
        total: allTransactions
          .filter((t) => t.category_id === c.id)
          .reduce((sum, t) => sum + t.amount, 0),
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [target, accounts, categories, allTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!allTransactions || !childId) return allTransactions;
    if (target?.groupBy === "account_group") {
      return allTransactions.filter((t) => t.account_id === childId);
    }
    return allTransactions.filter((t) => t.category_id === childId);
  }, [allTransactions, childId, target]);

  const total = useMemo(
    () => filteredTransactions?.reduce((sum, t) => sum + t.amount, 0) ?? 0,
    [filteredTransactions]
  );
  const allTotal = useMemo(
    () => allTransactions?.reduce((sum, t) => sum + t.amount, 0) ?? 0,
    [allTransactions]
  );

  // Kelompokkan transaksi per tanggal (bukan per timestamp penuh) utk
  // separator hari di list kiri -- urutan tetap terbaru dulu (query
  // sudah ORDER BY t.date DESC), tinggal group tanpa sort ulang.
  const transactionsByDay = useMemo(() => {
    if (!filteredTransactions) return [];
    const groups = new Map<string, typeof filteredTransactions>();
    for (const tx of filteredTransactions) {
      const dateOnly = tx.date.slice(0, 10);
      const existing = groups.get(dateOnly);
      if (existing) existing.push(tx);
      else groups.set(dateOnly, [tx]);
    }
    return Array.from(groups.entries()).map(([date, transactions]) => ({
      date,
      displayDate: formatDate(date, "date-only"),
      transactions,
    }));
  }, [filteredTransactions]);

  function handleOpenChange(open: boolean) {
    if (!open) setChildId(null);
    onOpenChange(open);
  }

  if (!target) return null;

  return (
    <Dialog open={!!target} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-6xl! grid h-[85vh] grid-rows-[auto_1fr] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{target.label}</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 gap-6 md:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-muted-foreground text-sm">
                {target.type === "expense" ? "Pengeluaran" : "Pemasukan"}
              </span>
              <span className="font-semibold">{formatCurrency(total, "IDR")}</span>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="pr-4">
                <QueryState isLoading={isLoading} error={error} />
                {filteredTransactions && filteredTransactions.length === 0 && (
                  <p className="text-muted-foreground px-1 text-sm">Tidak ada transaksi.</p>
                )}
                {transactionsByDay.length > 0 && (
                  <div className="space-y-4">
                    {transactionsByDay.map((group) => (
                      <div key={group.date}>
                        <p className="text-muted-foreground sticky top-0 bg-popover py-1 text-xs font-medium">
                          {group.displayDate}
                        </p>
                        <div className="divide-y">
                          {group.transactions.map((tx) => (
                            <CashflowTransactionRow
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
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
            <div className="max-h-48">
              <CashflowChildrenFilter
                options={childRows}
                value={childId}
                allLabel="Semua"
                allTotal={allTotal}
                onChange={setChildId}
              />
            </div>
            <div className="min-h-0">
              <CashflowTransactionsDailyChart
                transactions={filteredTransactions}
                color={CHART_COLOR[target.type]}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
