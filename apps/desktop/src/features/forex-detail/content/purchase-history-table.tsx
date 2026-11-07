"use client";

import { QueryState } from "@/components/query-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { formatRate } from "@/shared/forex/forex-format";
import { useForexPurchases } from "@/shared/forex/use-forex-queries";

// Koreksi atau hapus pembelian lewat halaman Transaksi (hapus transaksi ikut menghapus baris ini).
export function PurchaseHistoryTable({ accountId }: { accountId: string }) {
  const { data: purchases, isLoading, error } = useForexPurchases(accountId);

  if (isLoading || error) return <QueryState isLoading={isLoading} error={error} />;
  if (!purchases || purchases.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pembelian tercatat.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal</TableHead>
          <TableHead className="text-right">Jumlah</TableHead>
          <TableHead className="text-right">Kurs Beli</TableHead>
          <TableHead className="text-right">Nilai Saat Itu</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((purchase) => (
          <TableRow key={purchase.id}>
            <TableCell>{formatDate(purchase.date, "date-time")}</TableCell>
            <TableCell className="text-right">{purchase.unit}</TableCell>
            <TableCell className="text-right">{formatRate(purchase.rate)}</TableCell>
            <TableCell className="text-right">{formatCurrency(purchase.unit * purchase.rate, "IDR")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
