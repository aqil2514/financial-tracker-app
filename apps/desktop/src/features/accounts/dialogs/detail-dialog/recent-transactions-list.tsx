"use client";

import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-currency";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useCategories } from "@/features/categories";
import { useAccountTransactions } from "./use-account-transactions";

const typeConfig = {
  income: { icon: ArrowUpCircle, className: "text-green-600" },
  expense: { icon: ArrowDownCircle, className: "text-red-600" },
  transfer: { icon: ArrowLeftRight, className: "text-blue-600" },
};

/** Transaksi terbaru akun ini (sebagai account_id ATAU transfer_account_id)
 * — ringkasan cepat tanpa harus pindah ke halaman Transaksi dan filter
 * manual by akun. */
export function RecentTransactionsList({ accountId }: { accountId: number }) {
  const { data: transactions } = useAccountTransactions(accountId);
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
    <div className="space-y-2">
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
                      ? tx.account_id === accountId
                        ? `Ke ${accountName(tx.transfer_account_id)}`
                        : `Dari ${accountName(tx.account_id)}`
                      : (tx.note ?? "-")}
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
    </div>
  );
}
