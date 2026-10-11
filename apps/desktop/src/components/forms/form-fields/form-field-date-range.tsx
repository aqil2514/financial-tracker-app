import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";

import { Label } from "@/components/ui/label";
import { PeriodPicker } from "@/components/query/period-picker";

export const dateRangeSchema = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
  })
  .refine((range) => range.from !== undefined, {
    message: "Tanggal mulai wajib diisi",
    path: ["from"],
  })
  .refine((range) => range.to !== undefined, {
    message: "Tanggal akhir wajib diisi",
    path: ["to"],
  })
  .refine((range) => !range.from || !range.to || range.to >= range.from, {
    message: "Tanggal akhir tidak boleh sebelum tanggal mulai",
    path: ["to"],
  })
  .transform((range) => range as { from: Date; to: Date });

type FormFieldDateRangeProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
};

export function FormFieldDateRange<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  disabled,
}: FormFieldDateRangeProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label>{label}</Label>
          <PeriodPicker
            value={field.value}
            onChange={field.onChange}
            placeholder={placeholder}
            disabled={disabled}
          />
          {fieldState.error && (
            <p className="text-destructive text-sm">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
