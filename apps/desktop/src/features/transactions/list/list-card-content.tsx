"use client";

import { CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useList } from "./list-context";
import { TransactionListItem } from "./transaction-list-item";

export function ListCardContent() {
  const { transactions, isLoading, error } = useList();

  return (
    <CardContent>
      {isLoading && <p className="text-muted-foreground text-sm">Memuat...</p>}
      {error && (
        <p className="text-destructive text-sm">Gagal memuat: {error.message}</p>
      )}
      <ScrollArea className="h-[480px]">
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
