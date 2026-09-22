import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type FormFieldTextareaProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
};

export function FormFieldTextarea<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder,
}: FormFieldTextareaProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
          <Textarea
            id={name}
            placeholder={placeholder}
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
