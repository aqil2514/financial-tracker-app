"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useCheckBalanceConsistency } from "./use-check-balance-consistency";

export function BalanceConsistencyCheckDialog() {
  const [open, setOpen] = useState(false);
  const { run, reset, result, isPending } = useCheckBalanceConsistency();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) void run();
    else reset();
  }

  return (
    <EntityFormDialog
      trigger={
        <Button variant="outline">
          <ShieldCheck className="size-4" />
          Cek Konsistensi
        </Button>
      }
      title="Cek Konsistensi Data Turunan"
      open={open}
      onOpenChange={handleOpenChange}
      contentClassName="sm:!max-w-2xl max-h-[85vh] grid grid-rows-[auto_1fr] overflow-hidden"
    >
      <p className="text-muted-foreground text-sm">
        Mencari transaksi pada akun Utang-Piutang atau Investasi yang seharusnya punya
        data rincian pendamping (riwayat piutang/utang atau pembelian/penjualan), tapi
        ternyata tidak ada — pertanda kemungkinan drift dari bug lama atau migrasi yang
        tidak sempurna. Laporan ini murni diagnostik, tidak memperbaiki apa pun secara
        otomatis.
      </p>

      <ScrollArea className="h-full min-h-0">
        <div className="space-y-2 pt-4">
          {isPending && <p className="text-muted-foreground text-sm">Memeriksa...</p>}

          {!isPending && result && result.length === 0 && (
            <p className="text-sm text-green-600">
              Tidak ditemukan transaksi yang drift. Semua transaksi pada akun Utang-Piutang
              dan Investasi punya data rincian pendamping yang konsisten.
            </p>
          )}

          {!isPending && result && result.length > 0 && (
            <>
              <p className="text-destructive text-sm font-medium">
                Ditemukan {result.length} transaksi yang drift:
              </p>
              <div className="space-y-2">
                {result.map((row) => (
                  <div key={row.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{row.account_name ?? "Akun tidak ditemukan"}</span>
                      <Badge variant="secondary">
                        {row.account_type === "debt" ? "Utang Piutang" : "Investasi"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {row.type === "income" ? "Pemasukan" : row.type === "expense" ? "Pengeluaran" : "Transfer"}{" "}
                      {formatCurrency(row.amount, "IDR")} · {formatDate(row.date, "date-time")}
                    </p>
                    {row.note && <p className="text-muted-foreground text-xs">{row.note}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </EntityFormDialog>
  );
}
