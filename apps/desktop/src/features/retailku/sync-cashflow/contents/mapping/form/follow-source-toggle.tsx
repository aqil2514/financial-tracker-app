"use client";

import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Switch } from "@/components/ui/switch";

/** Toggle "Mengikuti Retailku" utk field `note`/`description` — dipakai
 * BAIK `form/generic/` MAUPUN `form/fund-transfer/` (field+alasan SAMA
 * di kedua varian: baris mapping itu levelnya per-KEY, bisa mewakili
 * BANYAK transaksi Retailku sekaligus — `note`/`description` statis
 * otomatis sama utk semuanya, kehilangan detail per transaksi, lihat
 * JSDoc `GenericMappingRowDraft`/`TransferMappingRowDraft`). SAAT ON,
 * field text/rich-text terkait DISARANKAN dinonaktifkan oleh pemanggil
 * (lihat pemakaian di `generic-mapping-row.tsx`/
 * `fund-transfer-mapping-form.tsx`) — nilai statisnya TETAP tersimpan
 * (tidak dihapus) sbg fallback kalau toggle dimatikan lagi. Disimpan ke
 * `extra_fields` (migrasi 0024), BUKAN kolom DB terpisah — lihat
 * `FieldMappingExtraFields`. */
export function FollowSourceToggle<TFieldValues extends FieldValues>({
  form,
  name,
  label,
}: {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
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
          {field.value && (
            <p className="text-muted-foreground pl-9 text-xs">
              Kalau key ini mewakili lebih dari 1 transaksi Retailku, hasilnya berupa daftar rincian
              tiap transaksi — bukan cuma satu nilai.
            </p>
          )}
        </div>
      )}
    />
  );
}
