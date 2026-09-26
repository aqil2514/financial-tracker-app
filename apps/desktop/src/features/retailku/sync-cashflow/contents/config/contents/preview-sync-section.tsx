"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { useRetailkuSyncCashflowConfig } from "../context";

/** Section "Preview Data" — tombol yang menghitung APA yang akan
 * disinkronkan (via `computeCashflowSync`, baca-saja, TIDAK insert apa
 * pun — SEKARANG sudah mencakup piutang/utang juga, lihat
 * docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md) lalu
 * menampilkannya di dialog sebelum user menekan "Sync Sekarang"
 * sungguhan. */
export function PreviewSyncSection() {
  const { prerequisites, fields, debtAccounts, syncFrom, preview } = useRetailkuSyncCashflowConfig();
  const [open, setOpen] = useState(false);

  const canPreview = prerequisites.hasCredentials && syncFrom.syncFromValue !== "";

  const handlePreview = () => {
    setOpen(true);
    preview.mutate({
      retailkuSettings: prerequisites.retailkuSettings,
      mode: fields.mode.value,
      syncFromValue: syncFrom.syncFromValue,
      arApCashAccountId: fields.arApCashAccountId.value,
      receivableDebtAccountId: debtAccounts.receivableDebtAccountId,
      payableDebtAccountId: debtAccounts.payableDebtAccountId,
    });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Preview Data</h3>
      <p className="text-muted-foreground text-sm">
        Lihat dulu transaksi apa saja yang akan tercatat sebelum menjalankan sync sungguhan.
      </p>
      <Button variant="outline" size="sm" onClick={handlePreview} disabled={!canPreview}>
        Lihat Preview
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Sinkronisasi</DialogTitle>
            <DialogDescription>
              Data ini dihitung langsung dari Retailku — belum ada yang disimpan. Tekan &quot;Sync
              Sekarang&quot; di tab Konfigurasi untuk benar-benar menjalankannya.
            </DialogDescription>
          </DialogHeader>

          {preview.isPending && <p className="text-muted-foreground text-sm">Menghitung preview...</p>}
          {preview.isError && (
            <p className="text-destructive text-sm">
              Gagal menghitung preview: {preview.error instanceof Error ? preview.error.message : String(preview.error)}
            </p>
          )}
          {preview.data && <PreviewContent result={preview.data} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewContent({ result }: { result: NonNullable<ReturnType<typeof useRetailkuSyncCashflowConfig>["preview"]["data"]> }) {
  const cashflowToInsert = result.cashflow.rows.filter((row) => row.willInsert);
  const cashflowSkipped = result.cashflow.rows.filter((row) => !row.willInsert);
  const arApToInsert = result.cashflow.arApRows.filter((row) => row.willInsert);

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStat label="Transaksi kas baru" value={cashflowToInsert.length} />
        <SummaryStat label="Baris di-skip" value={cashflowSkipped.length} />
        <SummaryStat label="Piutang/utang baru" value={arApToInsert.length} />
        <SummaryStat label="Akun belum dipetakan" value={result.cashflow.unmappedKeys.length} />
        <SummaryStat
          label="Akun dinonaktifkan"
          value={result.cashflow.deactivatedPaymentMethodAccountIds.length}
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Pergerakan Kas</h4>
        {result.cashflow.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada pergerakan kas pada rentang ini.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Akun Retailku</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.cashflow.rows.map((row) => (
                <TableRow key={row.sourceRef}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="text-muted-foreground">{row.accountName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.net, "IDR")}</TableCell>
                  <TableCell>
                    {row.willInsert ? (
                      <Badge variant="outline">Akan dicatat</Badge>
                    ) : row.skipReason === "unmapped-account" ? (
                      <Badge variant="destructive">Belum dipetakan</Badge>
                    ) : row.skipReason === "deactivated-payment-method" ? (
                      <Badge variant="destructive">Dinonaktifkan di Retailku</Badge>
                    ) : (
                      <Badge variant="secondary">Sudah tersinkron</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Piutang/Utang</h4>
        {result.cashflow.arApRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada pergerakan piutang/utang pada rentang ini.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.cashflow.arApRows.map((row) => (
                <TableRow key={row.sourceRef}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>
                    {row.direction === "receivable" ? "Piutang" : "Utang"}
                    {row.amount < 0 ? " (pelunasan)" : " (baru)"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Math.abs(row.amount), "IDR")}
                  </TableCell>
                  <TableCell>
                    {row.willInsert ? (
                      <Badge variant="outline">Akan dicatat</Badge>
                    ) : row.skipReason === "debt-account-not-configured" ? (
                      <Badge variant="destructive">Akun belum diatur</Badge>
                    ) : (
                      <Badge variant="secondary">Sudah tersinkron</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5 rounded-lg border p-2.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-medium">{value}</p>
    </div>
  );
}
