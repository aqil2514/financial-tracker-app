"use client";

import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Switch } from "@/components/ui/switch";

const DEFAULT_HELP_TEXT =
  "Kalau key ini mewakili lebih dari 1 transaksi Retailku, nilainya ikut ASLI tiap transaksi (bukan satu teks statis yang sama untuk semua).";

/** Toggle "Mengikuti Retailku" — dipakai `form/generic/`+`form/fund-
 * transfer/` (field `note`/`description`) DAN `form/ar-ap/` (field
 * kontak). Alasan dasarnya SAMA di ketiganya: baris mapping levelnya
 * per-KEY, bisa mewakili BANYAK transaksi Retailku sekaligus — nilai
 * statis otomatis sama utk semuanya, kehilangan detail per transaksi,
 * lihat JSDoc `GenericMappingRowDraft`/`TransferMappingRowDraft`/
 * `ArApMappingRowDraft`. SAAT ON, field terkait DISARANKAN dinonaktifkan
 * oleh pemanggil (lihat pemakaian di `generic-mapping-row.tsx`/
 * `fund-transfer-mapping-form.tsx`/`ar-ap-mapping-form.tsx`) — nilai
 * statisnya TETAP tersimpan (tidak dihapus) sbg fallback kalau toggle
 * dimatikan lagi. Disimpan ke `extra_fields` (migrasi 0024), BUKAN
 * kolom DB terpisah — lihat `FieldMappingExtraFields`.
 *
 * `helpText` opsional — default cocok utk note/description (nilainya
 * BENAR berupa teks berbeda per transaksi kalau ditampilkan satu-satu).
 * Field kontak AR/AP PERLU teks beda (lihat `ar-ap-mapping-form.tsx`):
 * defaultnya bisa dibaca seolah field kontak jadi ARRAY/daftar, padahal
 * tiap transaksi TETAP dapat SATU kontak — cuma nilainya dinamis (ikut
 * nama pihak transaksi itu), bukan gabungan dalam satu field. */
export function FollowSourceToggle<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  helpText = DEFAULT_HELP_TEXT,
}: {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  helpText?: string;
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={field.value} onCheckedChange={field.onChange} size="sm" />
            <span className="text-muted-foreground">{label}</span>
          </label>
          {field.value && <p className="text-muted-foreground pl-9 text-xs">{helpText}</p>}
        </div>
      )}
    />
  );
}
