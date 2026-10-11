import { useState, type ReactNode } from "react";
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

const CREATE_OPTION_VALUE = "__create-new__";

type FormFieldComboboxProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  options: FormFieldComboboxOption[];
  allowClear?: boolean;
  disabled?: boolean;
  renderOption?: (item: FormFieldComboboxOption) => ReactNode;
  onCreateNew?: (query: string) => void;
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
  onCreateNew,
}: FormFieldComboboxProps<TFieldValues>) {
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const hasExactMatch = options.some(
    (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCreateOption = Boolean(onCreateNew) && trimmedQuery.length > 0 && !hasExactMatch;
  const displayOptions: FormFieldComboboxOption[] = showCreateOption
    ? [...options, { value: CREATE_OPTION_VALUE, label: trimmedQuery }]
    : options;

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
                items={displayOptions}
                value={selected}
                onValueChange={(item: FormFieldComboboxOption | null) => {
                  if (!item) {
                    field.onChange(null);
                    return;
                  }
                  if (item.value === CREATE_OPTION_VALUE) {
                    onCreateNew?.(item.label);
                    return;
                  }
                  field.onChange(item.value);
                }}
                onInputValueChange={onCreateNew ? (value: string) => setQuery(value) : undefined}
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
                        {item.value === CREATE_OPTION_VALUE
                          ? `Buat baru: "${item.label}"`
                          : renderOption
                            ? renderOption(item)
                            : item.label}
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
