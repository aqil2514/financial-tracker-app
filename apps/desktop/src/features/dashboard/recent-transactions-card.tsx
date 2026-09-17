"use client";

import Link from "next/link";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { useRecentTransactions } from "./use-recent-transactions";

const typeConfig = {
  income: { icon: ArrowUpCircle, className: "text-green-600" },
  expense: { icon: ArrowDownCircle, className: "text-red-600" },
  transfer: { icon: ArrowLeftRight, className: "text-blue-600" },
};

export function RecentTransactionsCard() {
  const { data: transactions, isLoading, error } = useRecentTransactions();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  function accountName(id: number | null) {
    return accounts?.find((account) => account.id === id)?.name ?? "-";
  }

  function categoryName(id: number | null) {
    return categories?.find((category) => category.id === id)?.name ?? null;
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Transaksi Terbaru</CardTitle>
        <Button variant="ghost" size="sm" render={<Link href="/transactions" />}>
          Lihat semua
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-muted-foreground text-sm">Memuat...</p>}
        {error && (
          <p className="text-destructive text-sm">
            Gagal memuat: {(error as Error).message}
          </p>
        )}
        {transactions && transactions.length === 0 && (
          <p className="text-muted-foreground text-sm">Belum ada transaksi.</p>
        )}
        {transactions?.map((tx) => {
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
                    {formatDateTime(tx.date)}
                  </p>
                </div>
              </div>
              <p className={`font-medium ${config.className}`}>
                {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                {formatRupiah(tx.amount)}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
