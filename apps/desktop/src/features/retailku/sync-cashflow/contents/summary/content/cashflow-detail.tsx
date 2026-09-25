"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useRetailkuSyncCashflowSummary } from "../summary-context";
import { useRetailkuCashflowDetail } from "../hooks/use-retailku-cashflow-detail";

export function CashflowDetailTab() {
  const { range } = useRetailkuSyncCashflowSummary();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useRetailkuCashflowDetail(
    range,
    page,
  );

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        Memuat pergerakan cashflow...
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Gagal memuat: {error instanceof Error ? error.message : String(error)}
      </p>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Tidak ada data untuk rentang ini.
      </p>
    );
  }

  const { pagination } = data.meta;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Keterangan</TableHead>
            <TableHead>Akun Kas</TableHead>
            <TableHead>Sumber</TableHead>
            <TableHead className="text-right">Masuk</TableHead>
            <TableHead className="text-right">Keluar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((row) => (
            <TableRow key={row.accountId + row.date + (row.sourceNumber ?? "")}>
              <TableCell>{formatDate(row.date, "date-only")}</TableCell>
              <TableCell>{row.description ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.accountCode} - {row.accountName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.sourceNumber ?? "—"}
              </TableCell>
              <TableCell className="text-right text-green-600">
                {row.debit > 0 ? formatCurrency(row.debit, "IDR") : "-"}
              </TableCell>
              <TableCell className="text-right text-red-600">
                {row.credit > 0 ? formatCurrency(row.credit, "IDR") : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Halaman {pagination.page} dari {pagination.totalPages} (
          {pagination.total} baris)
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  );
}
