"use client";

import { QueryState } from "@/components/query-state";
import { CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useList } from "../context";
import { TransactionListItem } from "./item";
import type { TransactionListRow } from "../use-transactions";

// Total income/expense dihitung dari data yg sedang tampil di halaman ini
// (sudah kena filter aktif), BUKAN query terpisah per-tanggal spt kalender
// (use-transaction-days.ts) -- supaya angkanya match apa yg user lihat,
// termasuk saat difilter per akun/tipe. `transfer` di-skip, konsisten dgn
// definisi income/expense di tempat lain (lihat calendar-day-button.tsx).
function summarizeDay(transactions: TransactionListRow[]) {
  return transactions.reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.income += tx.amount;
      if (tx.type === "expense") acc.expense += tx.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
}

export function ListCardContent() {
  const { transactions, isLoading, error } = useList().data;

  // Grup per tanggal (bagian sebelum "T") supaya urutan hasil query (sudah
  // terurut lewat ORDER BY, lihat use-transactions) tetap dipakai apa adanya
  // -- cukup disisipi header tiap kali tanggalnya berubah.
  const groups: { dateKey: string; rows: TransactionListRow[] }[] = [];
  for (const tx of transactions ?? []) {
    const dateKey = tx.date.slice(0, 10);
    const currentGroup = groups.at(-1);
    if (currentGroup?.dateKey === dateKey) {
      currentGroup.rows.push(tx);
    } else {
      groups.push({ dateKey, rows: [tx] });
    }
  }

  return (
    <CardContent>
      <QueryState isLoading={isLoading} error={error} />
      <ScrollArea className="h-120">
        <div className="space-y-3 pr-4">
          {groups.map((group) => {
            const { income, expense } = summarizeDay(group.rows);

            return (
              <div key={group.dateKey} className="space-y-3">
                <div className="bg-muted/50 sticky top-0 z-10 -mx-1 flex items-baseline justify-between rounded-md border-l-2 border-l-primary px-3 py-1.5 backdrop-blur-sm">
                  <p className="text-sm font-semibold tracking-tight">
                    {formatDate(group.dateKey, "full-date")}
                  </p>
                  <p className="text-xs font-medium">
                    {income > 0 && (
                      <span className="text-green-600">+{formatCurrency(income, "IDR")}</span>
                    )}
                    {income > 0 && expense > 0 && (
                      <span className="text-muted-foreground mx-1">·</span>
                    )}
                    {expense > 0 && (
                      <span className="text-red-600">-{formatCurrency(expense, "IDR")}</span>
                    )}
                  </p>
                </div>
                {group.rows.map((tx) => (
                  <TransactionListItem key={tx.id} tx={tx} />
                ))}
              </div>
            );
          })}
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
