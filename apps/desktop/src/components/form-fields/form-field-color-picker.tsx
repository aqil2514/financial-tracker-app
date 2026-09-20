import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "cn";
import {
  ACCOUNT_COLORS,
  ACCOUNT_COLOR_NAMES,
  DEFAULT_ACCOUNT_COLOR,
} from "@/lib/account-colors";

type FormFieldColorPickerProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
};

/** Grid swatch dari palet warna TERBATAS (lib/account-colors.ts) di
 * dalam popover — BUKAN color picker hex bebas, supaya hasilnya tetap
 * konsisten dengan desain sistem aplikasi. Dipisah dari icon picker:
 * warna dipilih independen dari bentuk icon. */
export function FormFieldColorPicker<TFieldValues extends FieldValues>({
  form,
  name,
  label,
}: FormFieldColorPickerProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const selectedName = field.value ?? DEFAULT_ACCOUNT_COLOR;
        const selected = ACCOUNT_COLORS[selectedName] ?? ACCOUNT_COLORS[DEFAULT_ACCOUNT_COLOR];
        return (
          <div className="space-y-2">
            <Label>{label}</Label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button type="button" variant="outline" className="justify-start gap-2">
                    <span className={cn("size-4 rounded-full", selected.bg)} />
                    {selected.label}
                  </Button>
                }
              />
              <PopoverContent className="w-56">
                <div className="grid grid-cols-5 gap-1">
                  {ACCOUNT_COLOR_NAMES.map((colorName) => {
                    const color = ACCOUNT_COLORS[colorName];
                    const isSelected = field.value === colorName;
                    return (
                      <Button
                        key={colorName}
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => field.onChange(colorName)}
                        title={color.label}
                        className={cn(isSelected && "ring-2 ring-ring ring-offset-1")}
                      >
                        <span className={cn("size-4 rounded-full", color.bg)} />
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
