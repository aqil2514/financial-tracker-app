"use client";

import { useState } from "react";
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import CurrencyInput from "react-currency-input-field";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type UnitAmountFieldProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  optional?: boolean;
};

/**
 * Input jumlah unit investasi — pakai `react-currency-input-field` (pola
 * sama `PricePerUnitField`), BUKAN native `<input type="number">`
 * (`FormFieldNumber`). Alasan: native number input me-render separator
 * desimal sesuai locale OS/browser secara tidak konsisten (kadang koma,
 * kadang titik, tergantung environment) sementara field "Harga per Unit"
 * di sampingnya SELALU koma Indonesia (`decimalSeparator=","` eksplisit)
 * — bikin dua field yang berdampingan terasa tidak konsisten. Field ini
 * tidak pakai prefix "Rp" (bukan uang, satuan unit/lembar/gram dst).
 */
export function UnitAmountField<TFieldValues extends FieldValues>({
  form,
  name,
  label = "Jumlah Unit",
  optional = true,
}: UnitAmountFieldProps<TFieldValues>) {
  // Display string LOKAL, terpisah dari field.value (number) -- state
  // mentah yang sedang diketik ("7," sebelum digit desimal berikutnya)
  // TIDAK PUNYA representasi number yang valid, jadi tidak bisa dipakai
  // langsung sebagai `value` prop terkontrol (bug nyata 2026-10-07,
  // lihat docs/dogfooding/2026-10-07-unit-amount-field-koma-desimal-hilang-parsefloat.md
  // revisi kedua): kalau `value={field.value}` dipaksa re-render tiap
  // keystroke dari number form state, koma "di tengah proses" diketik
  // hilang lagi karena belum ada float valid untuk dikembalikan. Pola
  // ini (string display terpisah) sama dengan `displayValue` di
  // price-per-unit-field.tsx.
  const [display, setDisplay] = useState<string | undefined>(undefined);

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label htmlFor={name}>
            {label}
            {optional ? " (opsional)" : ""}
          </Label>
          <CurrencyInput
            id={name}
            name={field.name}
            value={display !== undefined ? display : (field.value ?? "")}
            onValueChange={(raw, _name, values) => {
              setDisplay(raw);
              field.onChange(values?.float ?? null);
            }}
            onBlur={() => {
              setDisplay(undefined);
              field.onBlur();
            }}
            placeholder="Kosongkan kalau belum tahu"
            decimalsLimit={4}
            groupSeparator="."
            decimalSeparator=","
            className={cn(
              "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
              fieldState.invalid &&
                "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40"
            )}
          />
          {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}
