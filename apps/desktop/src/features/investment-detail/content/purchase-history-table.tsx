"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/query-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useInvestmentPurchases, type InvestmentPurchaseRow } from "@/shared/investments/use-investment-purchases";
import { PURCHASE_STATUS_LABEL, PURCHASE_STATUS_VARIANT } from "@/shared/investments/purchase-status-labels";
import { EditInvestmentPurchaseDialog } from "@/shared/investments/edit-purchase-form/edit-investment-purchase-dialog";

/** Riwayat pembelian per lot satu akun investment — tiap baris lahir
 * otomatis dari transfer kas->investment (lihat applyInvestmentTransaction).
 * Aksi "Edit" di sini CUMA mengubah `investment_purchases` (unit, harga,
 * status) secara langsung — dipakai untuk isi/koreksi unit-harga begitu
 * settlement dikonfirmasi (lihat migrasi 0038). Nominal/tanggal/akun ikut
 * transaksi transfer aslinya, diubah lewat halaman Transaksi, BUKAN di sini. */
export function PurchaseHistoryTable({ accountId }: { accountId: string }) {
  const { data: purchases, isLoading, error } = useInvestmentPurchases(accountId);
  const [editingPurchase, setEditingPurchase] = useState<InvestmentPurchaseRow | null>(null);

  if (isLoading || error) {
    return <QueryState isLoading={isLoading} error={error} />;
  }

  if (!purchases || purchases.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pembelian tercatat.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-0" />
            <TableHead>Tanggal</TableHead>
            <TableHead className="text-right">Unit</TableHead>
            <TableHead className="text-right">Harga/Unit</TableHead>
            <TableHead className="text-right">Nilai Saat Itu</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingPurchase(purchase)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TableCell>
              <TableCell>{formatDate(purchase.date, "date-time")}</TableCell>
              <TableCell className="text-right">{purchase.unit ?? "—"}</TableCell>
              <TableCell className="text-right">
                {purchase.price_per_unit != null ? formatCurrency(purchase.price_per_unit, "IDR") : "—"}
              </TableCell>
              <TableCell className="text-right">
                {purchase.unit != null && purchase.price_per_unit != null
                  ? formatCurrency(purchase.unit * purchase.price_per_unit, "IDR")
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={PURCHASE_STATUS_VARIANT[purchase.status]}>
                  {PURCHASE_STATUS_LABEL[purchase.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingPurchase && (
        <EditInvestmentPurchaseDialog
          purchase={editingPurchase}
          open={editingPurchase != null}
          onOpenChange={(next) => {
            if (!next) setEditingPurchase(null);
          }}
        />
      )}
    </>
  );
}
