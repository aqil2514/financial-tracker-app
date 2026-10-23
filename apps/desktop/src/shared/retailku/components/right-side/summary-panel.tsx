"use client";

import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import type { RetailkuSummaryToolEntry } from "../../registry/types";
import { useInnerRetailkuPicker } from "../context";

export function SummaryPanel({ tool }: { tool: RetailkuSummaryToolEntry }) {
  const { client, status, selectedTool, dateRange, goToMapStep } = useInnerRetailkuPicker();
  const range = dateRange?.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : null;

  const {
    data: entries,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["retailku-picker-summary", selectedTool, range?.from, range?.to],
    queryFn: () =>
      tool.fetchSummary(client!, {
        dateFrom: format(range!.from, "yyyy-MM-dd"),
        dateTo: format(range!.to, "yyyy-MM-dd"),
      }),
    enabled: false,
  });

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        {!range ? (
          <p className="text-muted-foreground text-sm">Pilih rentang tanggal dulu di sebelah kiri.</p>
        ) : status !== "ready" ? (
          <p className="text-muted-foreground text-sm">Menghubungkan ke Retailku...</p>
        ) : isPending && entries === undefined ? (
          <p className="text-muted-foreground text-sm">
            Klik tombol di bawah untuk mengambil dan merangkum data pada rentang ini.
          </p>
        ) : isError ? (
          <p className="text-destructive text-sm">Gagal mengambil data dari Retailku.</p>
        ) : entries && entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada data pada rentang tanggal ini.</p>
        ) : entries ? (
          <ul className="divide-y rounded-lg border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span>{entry.label}</span>
                <span className="text-muted-foreground">
                  {entry.target === "transaction" ? entry.defaultValues.type : "Dana Pihak Ketiga"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="border-t p-4">
        <Button type="button" className="w-full" disabled={!range || status !== "ready"} onClick={() => refetch()}>
          Rangkum Rentang Ini
        </Button>
        {entries && entries.length > 0 && (
          <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => goToMapStep(entries)}>
            Lanjut ke Pemetaan ({entries.length})
          </Button>
        )}
      </div>
    </div>
  );
}
