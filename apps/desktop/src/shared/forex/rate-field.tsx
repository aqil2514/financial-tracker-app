"use client";

import { useState } from "react";
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import CurrencyInput from "react-currency-input-field";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RateFieldProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
};

// Input kurs (rupiah per 1 unit) dengan 2 desimal. FormFieldCurrency dibulatkan ke rupiah utuh,
// jadi tidak cocok untuk kurs. String tampilan dipisah dari nilai number supaya koma yang sedang
// diketik tidak hilang (pola sama unit-amount-field.tsx).
export function RateField<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  description,
}: RateFieldProps<TFieldValues>) {
  const [display, setDisplay] = useState<string | undefined>(undefined);

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
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
            placeholder="Mis. 16.250"
            prefix="Rp "
            decimalsLimit={2}
            groupSeparator="."
            decimalSeparator=","
            className={cn(
              "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
              fieldState.invalid &&
                "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40"
            )}
          />
          {description && !fieldState.error && <p className="text-muted-foreground text-xs">{description}</p>}
          {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}
