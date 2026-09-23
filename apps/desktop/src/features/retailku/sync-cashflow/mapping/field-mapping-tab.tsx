"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RetailkuCashflowSyncMode } from "../sync";
import { FieldMappingRow } from "./field-mapping-row";
import { MappingProvider, useMappingContext } from "./mapping-context";

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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Ringkas</SelectItem>
              <SelectItem value="detail">Detail per kategori</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Dari tanggal</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Sampai tanggal</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Akun Retailku</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Akun Tujuan</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Deskripsi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <FieldMappingRow
                  key={row.key}
                  row={row}
                  localAccountOptions={localAccountOptions}
                  categoryOptions={categoryOptions}
                  onChange={(patch) => updateDraft(row.key, patch)}
                />
              ))}
            </TableBody>
          </Table>
          {isDirty && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan Mapping"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
