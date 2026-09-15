import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import CurrencyInput from "react-currency-input-field";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldCurrencyProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
};

export function FormFieldCurrency<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder = "Masukkan nominal...",
}: FormFieldCurrencyProps<TFieldValues>) {
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
            value={field.value ?? ""}
            onValueChange={(value: string | undefined) => {
              field.onChange(value ? parseFloat(value) : 0);
            }}
            onBlur={field.onBlur}
            placeholder={placeholder}
            prefix="Rp "
            decimalsLimit={0}
            groupSeparator="."
            decimalSeparator=","
            className={cn(
              "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
              fieldState.invalid &&
                "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40"
            )}
          />
          {fieldState.error && (
            <p className="text-destructive text-sm">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
