"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { useRetailkuArAp } from "@/shared/retailku";

/** Tab "Utang Piutang" — data get_ar_ap, snapshot outstanding SAAT INI
 * per pihak (bukan rentang tanggal, lihat "Keterkaitan dengan sync
 * utang-piutang" di retailku-cashflow-sync.md). Read-only murni, BELUM
 * jadi sumber data sync (itu dokumen terpisah). */
export function ArApTab() {
  const { data, isLoading, isError, error } = useRetailkuArAp();

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Memuat data utang piutang...</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Gagal memuat: {error instanceof Error ? error.message : String(error)}
      </p>
    );
  }

  if (!data || data.parties.length === 0) {
    return <p className="text-muted-foreground text-sm">Tidak ada piutang/utang outstanding saat ini.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Total Piutang: </span>
          <span className="font-medium">{formatCurrency(data.totalReceivable, "IDR")}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Total Utang: </span>
          <span className="font-medium">{formatCurrency(data.totalPayable, "IDR")}</span>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pihak</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Piutang</TableHead>
            <TableHead className="text-right">Utang</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.parties.map((party) => (
            <TableRow key={party.id}>
              <TableCell>{party.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{party.type === "CUSTOMER" ? "Pelanggan" : "Pemasok"}</Badge>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(party.outstandingReceivable, "IDR")}</TableCell>
              <TableCell className="text-right">{formatCurrency(party.outstandingPayable, "IDR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
