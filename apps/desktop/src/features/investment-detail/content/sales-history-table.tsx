"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { QueryState } from "@/components/query-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { SettleSaleDialog } from "@/shared/investments/settle-sale-form/settle-sale-dialog";
import { useDeletePendingInvestmentSale } from "@/shared/investments/use-delete-pending-investment-sale";
import { useInvestmentSales, type InvestmentSaleRow } from "@/shared/investments/use-investment-sales";
import { PURCHASE_STATUS_LABEL, PURCHASE_STATUS_VARIANT } from "@/shared/investments/purchase-status-labels";

/** Riwayat penjualan per lot satu akun investment — pola persis
 * `PurchaseHistoryTable`, arah sebaliknya. `realized_pl` ditampilkan apa
 * adanya (snapshot permanen, BUKAN live-computed seperti Unrealized P/L
 * di header — lihat apply-sell-investment-transaction.ts).
 *
 * Baris `pending` (dana belum cair, lihat komentar panjang di
 * apply-sell-investment-transaction.ts) py DUA aksi yang baris `settled`
 * TIDAK py: "Settle" (buka SettleSaleDialog, pilih akun kas tujuan, baru
 * di situ transaksi dibuat) dan "Hapus" (hard-delete langsung, baris
 * pending tidak terikat transaksi apa pun). Baris `settled` TIDAK py aksi
 * apa pun di sini — koreksinya lewat edit/hapus TRANSAKSI utamanya di
 * halaman Transaksi (konsisten dgn baris lain yang py transaksi riil). */
export function SalesHistoryTable({ accountId }: { accountId: string }) {
  const { data: sales, isLoading, error } = useInvestmentSales(accountId);
  const [settlingSale, setSettlingSale] = useState<InvestmentSaleRow | null>(null);
  const { mutate: deleteSale, isPending: isDeleting } = useDeletePendingInvestmentSale();

  if (isLoading || error) {
    return <QueryState isLoading={isLoading} error={error} />;
  }

  if (!sales || sales.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada penjualan tercatat.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead className="text-right">Unit</TableHead>
            <TableHead className="text-right">Harga Jual/Unit</TableHead>
            <TableHead className="text-right">Avg. Cost/Unit</TableHead>
            <TableHead className="text-right">Realized P/L</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell>{formatDate(sale.date, "date-time")}</TableCell>
              <TableCell className="text-right">{sale.unit}</TableCell>
              <TableCell className="text-right">{formatCurrency(sale.price_per_unit, "IDR")}</TableCell>
              <TableCell className="text-right">
                {sale.average_cost_per_unit != null ? formatCurrency(sale.average_cost_per_unit, "IDR") : "—"}
              </TableCell>
              <TableCell
                className={`text-right font-medium ${
                  sale.realized_pl == null ? "" : sale.realized_pl >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {sale.realized_pl == null
                  ? "—"
                  : `${sale.realized_pl >= 0 ? "+" : ""}${formatCurrency(sale.realized_pl, "IDR")}`}
              </TableCell>
              <TableCell>
                <Badge variant={PURCHASE_STATUS_VARIANT[sale.status]}>{PURCHASE_STATUS_LABEL[sale.status]}</Badge>
              </TableCell>
              <TableCell>
                {sale.status === "pending" && (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setSettlingSale(sale)}>
                      Settle
                    </Button>
                    <ConfirmDeleteButton
                      isPending={isDeleting}
                      title="Hapus penjualan ini?"
                      description="Baris penjualan yang masih pending ini akan dihapus permanen. Unit yang sudah dikurangi dari holding akan dikembalikan."
                      onConfirm={() => deleteSale(sale.id)}
                    />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {settlingSale && (
        <SettleSaleDialog
          sale={settlingSale}
          open={settlingSale != null}
          onOpenChange={(next) => {
            if (!next) setSettlingSale(null);
          }}
        />
      )}
    </>
  );
}
