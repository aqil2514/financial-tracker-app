import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type FormFieldToggleGroupOption = {
  value: string;
  label: string;
};

type FormFieldToggleGroupProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
  options: FormFieldToggleGroupOption[];
  disabled?: boolean;
};

export function FormFieldToggleGroup<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  description,
  options,
  disabled,
}: FormFieldToggleGroupProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label>{label}</Label>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
          <ToggleGroup
            value={field.value ? [field.value] : []}
            onValueChange={(values: string[]) => {
              if (values.length > 0) {
                field.onChange(values[values.length - 1]);
              }
            }}
            className="w-full"
          >
            {options.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="flex-1"
                disabled={disabled}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
