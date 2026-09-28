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
import type { ArApSyncPlan, ArApSyncPlanRow } from "../../shared/sync";
import { useRetailkuSyncCashflowConfig } from "../context";

export function PreviewSyncSection() {
  const { prerequisites, fields, syncFrom, preview } = useRetailkuSyncCashflowConfig();
  const [open, setOpen] = useState(false);

  const canPreview = prerequisites.hasCredentials && syncFrom.range.from !== "";

  const handlePreview = () => {
    setOpen(true);
    preview.mutate({
      retailkuSettings: prerequisites.retailkuSettings,
      mode: fields.mode.value,
      arApExistingMode: fields.arApExistingMode.value,
      syncRangeValue: syncFrom.range,
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

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Transaksi kas baru" value={cashflowToInsert.length} />
        <SummaryStat label="Baris di-skip" value={cashflowSkipped.length} />
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

      <ArApPreview arAp={result.cashflow.arAp} />
    </div>
  );
}

function ArApPreview({ arAp }: { arAp: ArApSyncPlan }) {
  const toInsert = arAp.rows.filter((row) => row.willInsert);
  const toUpdate = arAp.rows.filter((row) => row.willUpdate);
  const toInsertPayment = arAp.rows.filter((row) => row.willInsertPayment);
  const toInsertPaymentsBatch = arAp.rows.filter((row) => row.willInsertPayments.length > 0);
  const skipped = arAp.rows.filter(
    (row) =>
      !row.willInsert && !row.willUpdate && !row.willInsertPayment && row.willInsertPayments.length === 0
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <SummaryStat label="Piutang/utang baru" value={toInsert.length} />
        <SummaryStat label="Akan ditimpa ulang" value={toUpdate.length} />
        <SummaryStat label="Pelunasan tercatat" value={toInsertPayment.length} />
        <SummaryStat label="Pelunasan konsinyasi" value={toInsertPaymentsBatch.length} />
        <SummaryStat label="Baris di-skip" value={skipped.length} />
        <SummaryStat label="Akun belum dipetakan" value={arAp.unmappedDebtKeys.length} />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Piutang / Utang</h4>
        {arAp.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada baris piutang/utang pada rentang ini.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead>Pihak</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {arAp.rows.map((row) => (
                <TableRow key={row.sourceRef}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="text-muted-foreground">{row.accountName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.partyName ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.amount, "IDR")}</TableCell>
                  <TableCell>
                    <ArApStatusBadge row={row} />
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

function ArApStatusBadge({ row }: { row: ArApSyncPlanRow }) {
  if (row.willInsert) return <Badge variant="outline">Piutang/utang baru</Badge>;
  if (row.willUpdate) return <Badge variant="outline">Akan ditimpa ulang</Badge>;
  if (row.willInsertPayment) return <Badge variant="outline">Pelunasan akan tercatat</Badge>;
  if (row.willInsertPayments.length > 0) {
    return <Badge variant="outline">Pelunasan konsinyasi ({row.willInsertPayments.length} utang)</Badge>;
  }

  switch (row.skipReason) {
    case "already-synced":
      return <Badge variant="secondary">Sudah tersinkron</Badge>;
    case "unmapped-debt-account":
      return <Badge variant="destructive">Belum dipetakan</Badge>;
    case "zero-amount":
      return <Badge variant="secondary">Lunas total (nihil)</Badge>;
    case "reversal":
      return <Badge variant="secondary">Dibalik di Retailku</Badge>;
    case "settlement-not-supported":
      return <Badge variant="secondary">Pelunasan (belum didukung)</Badge>;
    case "settled-debt-not-found":
      return <Badge variant="secondary">Piutang asal belum tersinkron</Badge>;
    case "settlement-partially-not-found":
      return <Badge variant="secondary">Sebagian piutang asal belum tersinkron</Badge>;
    default:
      return <Badge variant="secondary">Di-skip</Badge>;
  }
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5 rounded-lg border p-2.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-medium">{value}</p>
    </div>
  );
}
