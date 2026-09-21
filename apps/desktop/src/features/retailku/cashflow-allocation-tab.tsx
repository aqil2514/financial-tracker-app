"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { useRetailkuCashflowAllocation, type CashflowDateRange } from "@/shared/retailku";

/** Tab "Alokasi" — data get_cashflow_allocation, breakdown per
 * sourceType -> akun lawan NON-KAS (akun kas sendiri sengaja
 * dikecualikan Retailku, lihat "Temuan besar" di
 * retailku-cashflow-sync.md). Ditampilkan sebagai info tambahan saja,
 * BUKAN sumber data sync. */
export function CashflowAllocationTab({ range }: { range: CashflowDateRange }) {
  const { data, isLoading, isError, error } = useRetailkuCashflowAllocation(range);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Memuat alokasi cashflow...</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Gagal memuat: {error instanceof Error ? error.message : String(error)}
      </p>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">Tidak ada data untuk rentang ini.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Breakdown per sumber transaksi → akun lawan (BUKAN akun kas itu
        sendiri — lihat kolom net di bawah sebagai sisi akun lawan, bukan
        uang masuk/keluar).
      </p>
      {data.map((group) => (
        <div key={group.sourceType} className="rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-2 font-medium">{group.sourceType}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Akun Lawan</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.breakdown.map((row) => (
                <TableRow key={row.accountName}>
                  <TableCell>{row.accountName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.net, "IDR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
