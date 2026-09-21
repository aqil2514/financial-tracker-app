"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CashflowDateRange } from "@/shared/retailku";
import { CashflowAllocationTab } from "./cashflow-allocation-tab";
import { CashflowDetailTab } from "./cashflow-detail-tab";
import { CashflowSummaryTab } from "./cashflow-summary-tab";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Panel utama /retailku/cashflow, lihat
 * docs/todos/plan/retailku-cashflow-sync.md. TAHAP INI: cuma
 * menampilkan data mentah dari ketiga tool cashflow Retailku
 * (Ringkasan/Alokasi/Pergerakan) untuk rentang tanggal yang dipilih —
 * BELUM ada logic sync (insert transaksi) sama sekali. Tab
 * "Konfigurasi" masih placeholder, menyusul setelah desain sync
 * (mode ringkas vs detail, trigger, dst) final.
 */
export function CashflowSyncPanel() {
  const [range, setRange] = useState<CashflowDateRange>({
    dateFrom: daysAgoIso(7),
    dateTo: todayIso(),
    timezone: "Asia/Jakarta",
  });

  return (
    <Tabs defaultValue="ringkasan">
      <TabsList>
        <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
        <TabsTrigger value="konfigurasi">Konfigurasi</TabsTrigger>
      </TabsList>

      <TabsContent value="ringkasan" className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="cashflow-date-from">Dari tanggal</Label>
            <Input
              id="cashflow-date-from"
              type="date"
              value={range.dateFrom}
              onChange={(e) => setRange((prev) => ({ ...prev, dateFrom: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashflow-date-to">Sampai tanggal</Label>
            <Input
              id="cashflow-date-to"
              type="date"
              value={range.dateTo}
              onChange={(e) => setRange((prev) => ({ ...prev, dateTo: e.target.value }))}
            />
          </div>
        </div>

        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Ringkasan</TabsTrigger>
            <TabsTrigger value="allocation">Alokasi</TabsTrigger>
            <TabsTrigger value="detail">Pergerakan</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <CashflowSummaryTab range={range} />
          </TabsContent>
          <TabsContent value="allocation">
            <CashflowAllocationTab range={range} />
          </TabsContent>
          <TabsContent value="detail">
            <CashflowDetailTab range={range} />
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="konfigurasi">
        <p className="text-muted-foreground text-sm">
          Konfigurasi sinkronisasi (mode ringkas/detail, jadwal, dll) —
          segera hadir.
        </p>
      </TabsContent>
    </Tabs>
  );
}
