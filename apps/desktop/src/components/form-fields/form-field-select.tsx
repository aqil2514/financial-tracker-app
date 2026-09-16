import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormFieldSelectOption = {
  value: string;
  label: string;
};

type FormFieldSelectProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  options: FormFieldSelectOption[];
  /** Show a "Tanpa ..." item that clears the field back to null. */
  allowClear?: boolean;
  clearLabel?: string;
};

const CLEAR_VALUE = "__none__";

export function FormFieldSelect<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder = "Pilih...",
  options,
  allowClear = false,
  clearLabel = "Tanpa pilihan",
}: FormFieldSelectProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
          <Select
            value={field.value != null ? String(field.value) : ""}
            onValueChange={(value) =>
              field.onChange(value === CLEAR_VALUE ? null : value)
            }
          >
            <SelectTrigger id={name} className="w-full">
              <SelectValue placeholder={placeholder}>
                {(value: string | null) =>
                  options.find((option) => option.value === value)?.label ??
                  placeholder
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allowClear && (
                <SelectItem value={CLEAR_VALUE}>{clearLabel}</SelectItem>
              )}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
