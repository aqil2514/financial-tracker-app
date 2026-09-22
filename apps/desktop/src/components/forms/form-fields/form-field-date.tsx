import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldDateProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  /** Include hour/minute in the picker. Defaults to true. */
  withTime?: boolean;
};

export function FormFieldDate<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  withTime = true,
}: FormFieldDateProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
          <Input
            id={name}
            type={withTime ? "datetime-local" : "date"}
            {...field}
            value={field.value ?? ""}
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
