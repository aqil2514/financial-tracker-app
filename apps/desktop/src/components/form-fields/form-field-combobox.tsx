import type { ReactNode } from "react";
import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";

type FormFieldComboboxOption = {
  value: string;
  label: string;
};

type FormFieldComboboxProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  options: FormFieldComboboxOption[];
  /** Show a clear button that resets the field back to null. */
  allowClear?: boolean;
  disabled?: boolean;
  /** Custom isi tiap baris opsi di dropdown (mis. sisipkan icon di
   * depan label) — nilai TERPILIH di kotak input tetap teks polos
   * (`ComboboxInput` adalah text input native, tidak mendukung custom
   * render). Default: `item.label` seperti biasa. */
  renderOption?: (item: FormFieldComboboxOption) => ReactNode;
};

export function FormFieldCombobox<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder = "Cari...",
  options,
  allowClear = false,
  disabled,
  renderOption,
}: FormFieldComboboxProps<TFieldValues>) {
  const anchor = useComboboxAnchor();

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const selected =
          options.find((option) => option.value === String(field.value ?? "")) ??
          null;

        return (
          <div className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            <div ref={anchor}>
              <Combobox
                items={options}
                value={selected}
                onValueChange={(item: FormFieldComboboxOption | null) =>
                  field.onChange(item ? item.value : null)
                }
              >
                <ComboboxInput
                  id={name}
                  placeholder={placeholder}
                  showClear={allowClear}
                  disabled={disabled}
                />
                <ComboboxContent anchor={anchor}>
                  <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
                  <ComboboxList>
                    {(item: FormFieldComboboxOption) => (
                      <ComboboxItem key={item.value} value={item}>
                        {renderOption ? renderOption(item) : item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            {fieldState.error && (
              <p className="text-destructive text-sm">
                {fieldState.error.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
