"use client";

import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-currency";
import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { useRecentTransactions } from "./use-recent-transactions";

const typeConfig = {
  income: { icon: ArrowUpCircle, className: "text-green-600" },
  expense: { icon: ArrowDownCircle, className: "text-red-600" },
  transfer: { icon: ArrowLeftRight, className: "text-blue-600" },
};

export function ListContent() {
  const { data: transactions } = useRecentTransactions();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const accountName = (id: number | null) =>
    accounts?.find((account) => account.id === id)?.name ?? "-";

  const categoryName = (id: number | null) =>
    categories?.find((category) => category.id === id)?.name ?? null;

  if (!transactions) return null;

  if (transactions.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada transaksi.</p>;
  }

  return (
    <>
      {transactions.map((tx) => {
        const config = typeConfig[tx.type];
        const Icon = config.icon;

        return (
          <div
            key={tx.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <Icon className={`size-5 shrink-0 ${config.className}`} />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {tx.type === "transfer"
                      ? `${accountName(tx.account_id)} → ${accountName(tx.transfer_account_id)}`
                      : accountName(tx.account_id)}
                  </p>
                  {categoryName(tx.category_id) && (
                    <Badge variant="secondary">{categoryName(tx.category_id)}</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatDate(tx.date, "date-time")}
                </p>
              </div>
            </div>
            <p className={`font-medium ${config.className}`}>
              {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
              {formatCurrency(tx.amount, "IDR")}
            </p>
          </div>
        );
      })}
    </>
  );
}
