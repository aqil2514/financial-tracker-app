"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CashflowDateRange } from "./summary/use-retailku-cashflow";
import { ArApTab } from "./summary/ar-ap";
import { CashflowAllocationTab } from "./summary/cashflow-allocation";
import { CashflowSummaryTab } from "./summary/cashflow-summary";
import { CashflowDetailTab } from "./summary/cashflow-detail";
import { CashflowConfigTab } from "./config";
import { FieldMappingTab } from "./mapping/field-mapping-tab";

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
 * docs/todos/plan/retailku-cashflow-sync.md. TAHAP INI: tab "Ringkasan"
 * menampilkan data mentah dari MCP Retailku (Ringkasan/Alokasi/
 * Pergerakan/Utang Piutang) untuk dilihat, tab "Konfigurasi" berisi
 * kontrol sync (prasyarat mapping, toggle mode, status, tombol "Sync
 * Sekarang") — TAPI fungsi sync inti (yang sesungguhnya insert
 * transaksi) BELUM dibangun, tombol masih disabled.
 */
export function CashflowSyncPanel() {
  const [range, setRange] = useState<CashflowDateRange>({
    dateFrom: daysAgoIso(7),
    dateTo: todayIso(),
    timezone: "Asia/Jakarta",
  });

  const summarySubTabs = [
    { value: "summary", label: "Ringkasan", content: <CashflowSummaryTab range={range} /> },
    { value: "allocation", label: "Alokasi", content: <CashflowAllocationTab range={range} /> },
    { value: "detail", label: "Pergerakan", content: <CashflowDetailTab range={range} /> },
    { value: "ar-ap", label: "Utang Piutang", content: <ArApTab /> },
  ];

  const mainTabs = [
    {
      value: "ringkasan",
      label: "Ringkasan",
      content: (
        <div className="space-y-4">
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
              {summarySubTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {summarySubTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      ),
    },
    { value: "mapping", label: "Mapping", content: <FieldMappingTab /> },
    { value: "konfigurasi", label: "Konfigurasi", content: <CashflowConfigTab /> },
  ];

  return (
    <Tabs defaultValue="ringkasan">
      <TabsList>
        {mainTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {mainTabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
