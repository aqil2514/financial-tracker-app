"use client";

import { useState } from "react";
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import CurrencyInput from "react-currency-input-field";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { formatRate } from "../forex-format";
import { rateFromTotal, totalFromRate } from "../forex-rate-math";
import { RateField } from "../rate-field";

type Props<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  // Field yang DISIMPAN: selalu kurs per unit, apa pun mode inputnya.
  name: FieldPath<TFieldValues>;
  remainingUnit: number;
  currency: string;
};

const inputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

// Toggle Kurs / Nilai total. Mode total: user menyalin "Nilai IDR" dari aplikasi bank, yang disimpan
// tetap kurs = nilai ÷ jumlah dipegang. Mode hanya state UI, tidak disimpan ke database.
export function RateOrTotalField<TFieldValues extends FieldValues>({
  form,
  name,
  remainingUnit,
  currency,
}: Props<TFieldValues>) {
  const canUseTotal = remainingUnit > 0;
  const [chosenMode, setChosenMode] = useState<"rate" | "total" | undefined>(undefined);
  const mode = canUseTotal ? (chosenMode ?? "total") : "rate";
  const [display, setDisplay] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Label>Isi berdasarkan</Label>
        <ToggleGroup
          value={[mode]}
          onValueChange={(values: string[]) => {
            if (values.length > 0) {
              setChosenMode(values[values.length - 1] as "rate" | "total");
              setDisplay(undefined);
            }
          }}
          size="sm"
        >
          <ToggleGroupItem value="total" disabled={!canUseTotal}>
            Nilai total
          </ToggleGroupItem>
          <ToggleGroupItem value="rate">Kurs</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {mode === "rate" ? (
        <RateField
          form={form}
          name={name}
          label="Kurs Terkini (Rp per 1 unit)"
          description={
            canUseTotal
              ? "Isi dengan kurs beli bank, yaitu kurs yang akan Anda terima saat menukar kembali ke rupiah."
              : "Belum ada unit dipegang, jadi nilai total belum bisa dipakai. Isi kurs langsung."
          }
        />
      ) : (
        <Controller
          control={form.control}
          name={name}
          render={({ field, fieldState }) => {
            const rate = Number(field.value) || 0;
            const computedTotal = rate > 0 ? totalFromRate(rate, remainingUnit) : "";
            return (
              <div className="space-y-2">
                <Label htmlFor={`${name}-total`}>Nilai Terkini (Rp, versi bank)</Label>
                <CurrencyInput
                  id={`${name}-total`}
                  value={display !== undefined ? display : computedTotal}
                  onValueChange={(raw, _name, values) => {
                    setDisplay(raw);
                    const next = values?.float != null ? rateFromTotal(values.float, remainingUnit) : null;
                    field.onChange(next);
                  }}
                  onBlur={() => {
                    setDisplay(undefined);
                    field.onBlur();
                  }}
                  placeholder="Mis. 541.110"
                  prefix="Rp "
                  decimalsLimit={2}
                  groupSeparator="."
                  decimalSeparator=","
                  className={cn(
                    inputClassName,
                    fieldState.invalid &&
                      "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40"
                  )}
                />
                <p className="text-muted-foreground text-xs">
                  Salin &quot;Nilai IDR&quot; dari aplikasi bank untuk {remainingUnit} {currency}
                  {rate > 0 ? `. Setara ${formatRate(rate)} per ${currency}.` : "."}
                </p>
                {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
