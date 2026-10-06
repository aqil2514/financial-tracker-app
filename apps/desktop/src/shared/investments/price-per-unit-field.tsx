"use client";

import { useState } from "react";
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import CurrencyInput from "react-currency-input-field";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type PricePerUnitFieldProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  /** Field yang DISIMPAN — selalu harga PER UNIT, berapapun mode input
   * yang dipilih user (lihat konversi di bawah). */
  name: FieldPath<TFieldValues>;
  /** Field jumlah unit di form yang sama — dipakai untuk konversi
   * total -> per unit saat mode "total" dipilih. */
  unitFieldName: FieldPath<TFieldValues>;
  label?: string;
  /** Tampilkan suffix "(opsional)" di label — default true. Set false
   * kalau form punya switch status yang mewajibkan field ini (mis.
   * status 'settled' di new-purchase-form/schema.ts). */
  optional?: boolean;
};

/**
 * Input harga dengan toggle "satuan"/"total" (keputusan 2026-10-06, lihat
 * docs/todos/plan/account-type-investment.md) — TANPA migrasi skema baru,
 * yang disimpan ke `price_per_unit` SELALU per unit:
 *
 * - Mode "satuan": nilai yang diketik dipakai apa adanya.
 * - Mode "total": nilai yang diketik dibagi `unit` (dari field lain di
 *   form yang sama) sebelum disimpan, supaya setara per unit. Kalau
 *   `unit` belum diisi/0, tidak bisa dikonversi -- input dikunci kosong
 *   sampai `unit` terisi (lihat `unitValue` di bawah).
 *
 * Mode sendiri CUMA state UI lokal (tidak disimpan ke DB) -- field
 * `price_per_unit` tetap satu-satunya sumber kebenaran tersimpan, jadi
 * tidak butuh kolom/migrasi baru.
 */
export function PricePerUnitField<TFieldValues extends FieldValues>({
  form,
  name,
  unitFieldName,
  label = "Harga per Unit saat ini",
  optional = true,
}: PricePerUnitFieldProps<TFieldValues>) {
  const [mode, setMode] = useState<"unit" | "total">("unit");
  const unitValue = form.watch(unitFieldName) as number | null;

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        // Nilai per-unit tersimpan (field.value) -> nilai yang ditampilkan
        // di input sesuai mode aktif.
        const displayValue =
          mode === "total" && field.value != null && unitValue
            ? field.value * unitValue
            : field.value;

        function handleChange(raw: string | undefined) {
          const parsed = raw ? parseFloat(raw) : null;
          if (parsed == null) {
            field.onChange(null);
            return;
          }
          if (mode === "total") {
            if (!unitValue) {
              // Belum bisa dikonversi tanpa unit -- jangan simpan nilai
              // yang salah makna, biarkan field.value tidak berubah.
              return;
            }
            field.onChange(parsed / unitValue);
            return;
          }
          field.onChange(parsed);
        }

        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={name}>
                {label}
                {optional ? " (opsional)" : ""}
              </Label>
              <ToggleGroup
                value={[mode]}
                onValueChange={(values: string[]) => {
                  if (values.length > 0) setMode(values[values.length - 1] as "unit" | "total");
                }}
                size="sm"
              >
                <ToggleGroupItem value="unit">Satuan</ToggleGroupItem>
                <ToggleGroupItem value="total">Total</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <CurrencyInput
              id={name}
              name={field.name}
              value={displayValue ?? ""}
              onValueChange={handleChange}
              onBlur={field.onBlur}
              placeholder={
                mode === "total" && !unitValue
                  ? "Isi jumlah unit dulu"
                  : "Kosongkan kalau belum tahu"
              }
              disabled={mode === "total" && !unitValue}
              prefix="Rp "
              decimalsLimit={2}
              groupSeparator="."
              decimalSeparator=","
              className={cn(
                "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
                fieldState.invalid &&
                  "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40"
              )}
            />
            {mode === "total" && unitValue != null && field.value != null ? (
              <p className="text-muted-foreground text-xs">
                Setara {formatRupiahPerUnit(field.value)} / unit
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Harga instrumen saat settlement — boleh beda dari Nominal (bisa ada biaya platform/selisih pembulatan).
              </p>
            )}
            {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
          </div>
        );
      }}
    />
  );
}

function formatRupiahPerUnit(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(
    value
  );
}
