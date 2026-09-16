import { useState } from "react";
import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import CurrencyInput from "react-currency-input-field";
import { CalculatorIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { NumpadCalculator } from "./numpad-calculator";

type FormFieldCurrencyProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  /** Use the numpad-with-expression popover instead of a plain input. */
  useCalculator?: boolean;
};

export function FormFieldCurrency<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder = "Masukkan nominal...",
  useCalculator = false,
}: FormFieldCurrencyProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) =>
        useCalculator ? (
          <CalculatorCurrencyField
            id={name}
            label={label}
            value={field.value ?? 0}
            onChange={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            error={fieldState.error?.message}
          />
        ) : (
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
        )
      }
    />
  );
}

function CalculatorCurrencyField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void;
  placeholder: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <CurrencyInput
          id={id}
          value={value || ""}
          onValueChange={(v: string | undefined) => {
            onChange(v ? parseFloat(v) : 0);
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          prefix="Rp "
          decimalsLimit={0}
          groupSeparator="."
          decimalSeparator=","
          className={cn(
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-9 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
            error &&
              "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40"
          )}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
              >
                <CalculatorIcon className="size-4" />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-64">
            <NumpadCalculator
              initialValue={value}
              onSubmit={(result) => {
                onChange(result);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
