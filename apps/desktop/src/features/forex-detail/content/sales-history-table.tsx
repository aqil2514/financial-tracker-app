"use client";

import { QueryState } from "@/components/query-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { formatRate } from "@/shared/forex/forex-format";
import { useForexSales } from "@/shared/forex/use-forex-queries";

// realized_pl adalah snapshot permanen saat jual, bukan dihitung ulang seperti Unrealized P/L.
export function SalesHistoryTable({ accountId }: { accountId: string }) {
  const { data: sales, isLoading, error } = useForexSales(accountId);

  if (isLoading || error) return <QueryState isLoading={isLoading} error={error} />;
  if (!sales || sales.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada penjualan tercatat.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal</TableHead>
          <TableHead className="text-right">Jumlah</TableHead>
          <TableHead className="text-right">Kurs Jual</TableHead>
          <TableHead className="text-right">Avg. Cost</TableHead>
          <TableHead className="text-right">Realized P/L</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell>{formatDate(sale.date, "date-time")}</TableCell>
            <TableCell className="text-right">{sale.unit}</TableCell>
            <TableCell className="text-right">{formatRate(sale.rate)}</TableCell>
            <TableCell className="text-right">{formatRate(sale.average_cost_per_unit)}</TableCell>
            <TableCell
              className={`text-right font-medium ${sale.realized_pl >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {sale.realized_pl >= 0 ? "+" : ""}
              {formatCurrency(sale.realized_pl, "IDR")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
