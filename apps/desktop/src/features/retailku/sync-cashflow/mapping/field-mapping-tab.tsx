"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { ArrayFieldTabs } from "@/components/pattern/array-field-tabs";
import { PeriodPicker } from "@/components/query/period-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RetailkuCashflowSyncMode } from "../sync";
import { FieldMappingRow } from "./field-mapping-row";
import { MappingOverviewPanel } from "./mapping-preview-panel";
import { MappingProvider, useMappingContext } from "./mapping-context";
import type { MappingRowDraft } from "./hooks/use-mapping-draft";

/** Tab "Mapping" — pengganti halaman /retailku/mapping lama, lihat
 * docs/todos/plan/retailku-sync-field-mapping.md. Beda dari mapping
 * akun lama (cuma "akun Retailku -> akun lokal"): di sini SATU baris
 * per `key` (jenis baris cashflow — akun+arah untuk mode ringkas,
 * akun+sourceType+arah untuk mode detail), dan field yang diatur bukan
 * cuma akun tujuan, tapi juga judul/kategori/deskripsi transaksi hasil
 * sync.
 *
 * Key BARU cuma "ada" setelah sync (atau preview-nya) menjumpai
 * kombinasi itu — makanya perlu tombol "Muat Key" yang memanggil MCP
 * (`computeCashflowSync`, baca-saja) untuk rentang tanggal tertentu,
 * BUKAN sekadar baca tabel `retailku_sync_field_mapping` (isinya cuma
 * yang SUDAH di-mapping).
 *
 * Layout: SATU tab (angka urut) per `key` untuk form edit detailnya —
 * kalau key yang di-mapping banyak, tabel lama makan banyak ruang ke
 * bawah. Di sampingnya ada panel "Ringkasan semua jenis" (persisten,
 * DI LUAR area tab) yang menampilkan status terisi/kosong tiap key
 * sekaligus, otomatis ikut berubah saat form diisi — klik salah satu
 * barisnya untuk lompat ke tab itu.
 */
export function FieldMappingTab() {
  return (
    <MappingProvider>
      <FieldMappingTabContent />
    </MappingProvider>
  );
}

function FieldMappingTabContent() {
  const {
    mode,
    setMode,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    handleLoadKeys,
    isLoadingKeys,
    loadKeysError,
    hasLoadedKeys,
    rows,
    updateDraft,
    isDirty,
    handleSave,
    isSaving,
    localAccountOptions,
    categoryOptions,
  } = useMappingContext();

  const [activeKey, setActiveKey] = useState<string | undefined>(undefined);

  // `dateFrom`/`dateTo` di draft bentuknya string "yyyy-MM-dd" (siap
  // pakai `computeCashflowSync`) — PeriodPicker sendiri bekerja dengan
  // `Date`, dikonversi di titik masuk/keluar sini, sama seperti pola di
  // features/account-detail/header/index.tsx.
  const periodValue = useMemo<DateRange | undefined>(
    () => ({ from: new Date(`${dateFrom}T00:00`), to: new Date(`${dateTo}T00:00`) }),
    [dateFrom, dateTo],
  );

  function handlePeriodChange(range: DateRange | undefined) {
    if (!range?.from || !range.to) return;
    setDateFrom(format(range.from, "yyyy-MM-dd"));
    setDateTo(format(range.to, "yyyy-MM-dd"));
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Atur akun tujuan, judul, dan kategori transaksi otomatis untuk tiap jenis pergerakan kas
        Retailku. Muat dulu jenis-jenis yang muncul pada rentang tanggal tertentu, lalu lengkapi
        yang belum dipetakan.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(value) => setMode(value as RetailkuCashflowSyncMode)}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(value: RetailkuCashflowSyncMode) =>
                  value === "summary" ? "Ringkas" : "Detail per kategori"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Ringkas</SelectItem>
              <SelectItem value="detail">Detail per kategori</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Periode</Label>
          <PeriodPicker value={periodValue} onChange={handlePeriodChange} />
        </div>
        <Button onClick={handleLoadKeys} disabled={isLoadingKeys}>
          {isLoadingKeys ? "Memuat..." : "Muat Jenis Transaksi"}
        </Button>
      </div>

      {loadKeysError && (
        <p className="text-destructive text-sm">
          Gagal memuat: {loadKeysError instanceof Error ? loadKeysError.message : String(loadKeysError)}
        </p>
      )}

      {!hasLoadedKeys && rows.length === 0 && !loadKeysError && (
        <p className="text-muted-foreground text-sm">
          Belum ada data. Tekan &quot;Muat Jenis Transaksi&quot; untuk melihat jenis pergerakan kas
          pada rentang tanggal di atas.
        </p>
      )}

      {rows.length > 0 && (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_2fr]">
          <MappingOverviewPanel
            rows={rows}
            activeKey={activeKey}
            onSelect={setActiveKey}
            localAccountOptions={localAccountOptions}
            categoryOptions={categoryOptions}
          />

          <div className="min-w-0 space-y-3">
            <ArrayFieldTabs
              items={rows.map((row) => ({ ...row, id: row.key }))}
              activeId={activeKey ?? rows[0]?.key}
              onActiveChange={setActiveKey}
              renderContent={(row: MappingRowDraft & { id: string }) => (
                <FieldMappingRow
                  row={row}
                  localAccountOptions={localAccountOptions}
                  categoryOptions={categoryOptions}
                  onChange={(patch) => updateDraft(row.key, patch)}
                />
              )}
            />
            {isDirty && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Menyimpan..." : "Simpan Mapping"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
