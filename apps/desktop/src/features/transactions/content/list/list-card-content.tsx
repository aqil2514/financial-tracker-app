"use client";

import { QueryState } from "@/components/query-state";
import { CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useList } from "./list-context";
import { TransactionListItem } from "./transaction-list-item";

export function ListCardContent() {
  const { transactions, isLoading, error } = useList();

  return (
    <CardContent>
      <QueryState isLoading={isLoading} error={error} />
      <ScrollArea className="h-120">
        <div className="space-y-3 pr-4">
          {transactions?.map((tx) => (
            <TransactionListItem key={tx.id} tx={tx} />
          ))}
          {transactions && transactions.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Belum ada transaksi. Tambahkan lewat tombol di atas.
            </p>
          )}
        </div>
      </ScrollArea>
    </CardContent>
  );
}
