"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { useRetailkuCashflowSummary, type CashflowDateRange } from "../use-retailku-cashflow";

/** Tab "Ringkasan" — persis data get_cashflow_summary: total periode +
 * rincian per hari, mirip kartu ringkasan di halaman Cashflow Retailku
 * (lihat docs/todos/plan/retailku-cashflow-sync.md). Ini SUMBER DATA
 * yang dipakai mode ringkas untuk sync nanti. */
export function CashflowSummaryTab({ range }: { range: CashflowDateRange }) {
  const { data, isLoading, isError, error } = useRetailkuCashflowSummary(range);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Memuat ringkasan cashflow...</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Gagal memuat: {error instanceof Error ? error.message : String(error)}
      </p>
    );
  }

  if (!data || data.data.length === 0) {
    return <p className="text-muted-foreground text-sm">Tidak ada data untuk rentang ini.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Pemasukan" value={data.totals.inflow} tone="income" />
        <SummaryCard label="Total Pengeluaran" value={data.totals.outflow} tone="expense" />
        <SummaryCard label="Net Periode" value={data.totals.net} tone="net" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead className="text-right">Pemasukan</TableHead>
            <TableHead className="text-right">Pengeluaran</TableHead>
            <TableHead className="text-right">Net</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((row) => (
            <TableRow key={row.date}>
              <TableCell>{row.date}</TableCell>
              <TableCell className="text-right text-green-600">
                {formatCurrency(row.inflow, "IDR")}
              </TableCell>
              <TableCell className="text-right text-red-600">
                {formatCurrency(row.outflow, "IDR")}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(row.net, "IDR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense" | "net";
}) {
  const toneClass =
    tone === "income" ? "text-green-600" : tone === "expense" ? "text-red-600" : "text-blue-600";
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{formatCurrency(value, "IDR")}</p>
    </div>
  );
}
