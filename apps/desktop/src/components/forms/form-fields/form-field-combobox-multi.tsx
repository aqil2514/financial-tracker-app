import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";

type FormFieldComboboxMultiOption = {
  value: string;
  label: string;
};

type FormFieldComboboxMultiProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  options: FormFieldComboboxMultiOption[];
  disabled?: boolean;
};

export function FormFieldComboboxMulti<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder = "Cari...",
  options,
  disabled,
}: FormFieldComboboxMultiProps<TFieldValues>) {
  const anchor = useComboboxAnchor();

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const selectedValues: string[] = field.value ?? [];
        const selectedItems = options.filter((option) => selectedValues.includes(option.value));

        return (
          <div className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            <Combobox
              items={options}
              multiple
              value={selectedItems}
              onValueChange={(items: FormFieldComboboxMultiOption[]) => {
                field.onChange(items.map((item) => item.value));
              }}
              disabled={disabled}
            >
              {selectedItems.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-input">
                  <ComboboxChips className="border-none bg-transparent p-2">
                    {selectedItems.map((item) => (
                      <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
                    ))}
                  </ComboboxChips>
                </div>
              )}
              <div ref={anchor}>
                <ComboboxInput id={name} placeholder={placeholder} disabled={disabled} />
                <ComboboxContent anchor={anchor}>
                  <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
                  <ComboboxList>
                    {(item: FormFieldComboboxMultiOption) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </div>
            </Combobox>
            {fieldState.error && (
              <p className="text-destructive text-sm">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
