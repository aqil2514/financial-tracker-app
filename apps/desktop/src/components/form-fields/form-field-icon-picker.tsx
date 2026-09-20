import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACCOUNT_ICON_NAMES, resolveAccountIcon } from "@/lib/account-icons";

type FormFieldIconPickerProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
};

/** Grid pilihan icon dari whitelist lucide-react (lib/account-icons.ts)
 * di dalam popover — dipicu dari tombol yang menampilkan icon terpilih
 * saat ini. Bukan dropdown/select biasa karena tiap opsi perlu tampil
 * sebagai ikon visual, bukan teks. */
export function FormFieldIconPicker<TFieldValues extends FieldValues>({
  form,
  name,
  label,
}: FormFieldIconPickerProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const SelectedIcon = resolveAccountIcon(field.value ?? null);
        return (
          <div className="space-y-2">
            <Label>{label}</Label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button type="button" variant="outline" className="justify-start gap-2">
                    <SelectedIcon className="size-4" />
                    {field.value ?? "Pilih icon..."}
                  </Button>
                }
              />
              <PopoverContent className="w-64">
                <div className="grid grid-cols-6 gap-1">
                  {ACCOUNT_ICON_NAMES.map((iconName) => {
                    const OptionIcon = resolveAccountIcon(iconName);
                    const selected = field.value === iconName;
                    return (
                      <Button
                        key={iconName}
                        type="button"
                        variant={selected ? "default" : "ghost"}
                        size="icon-sm"
                        onClick={() => field.onChange(iconName)}
                        title={iconName}
                      >
                        <OptionIcon className="size-4" />
                      </Button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            {fieldState.error && (
              <p className="text-destructive text-sm">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
