"use client";

import { useState } from "react";
import { Controller, type Control } from "react-hook-form";

import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { useLabels, type LabelScope } from "./use-labels";

type LabelOption = { value: string; label: string };

const CREATE_PREFIX = "__create__:";

/** Bentuk minimal form yang dibutuhkan field ini -- `label_names` array
 * NAMA (bukan id), sama prinsip `contact_name` di ContactField: resolusi
 * ke id (termasuk create label baru yang belum ada) terjadi di submit
 * time lewat `resolveLabelIds` (lihat resolve-label-ids.ts), BUKAN di
 * sini. Dipakai bersama oleh form transaksi, kategori, DAN akun --
 * scope-nya beda per pemakai (lihat prop `scope`), bukan field-nya. */
type LabelFormValues = { label_names: string[] };

type LabelFieldProps<TFieldValues extends LabelFormValues> = {
  control: Control<TFieldValues>;
  scope: LabelScope;
  label: string;
  disabled?: boolean;
};

/** Multi-select combobox label, dgn chip + inline create (keputusan
 * desain di docs/todos/plan/general-label.md: "multi-select combobox
 * biasa" + "label baru dibuat inline dari form"). Primitif `Combobox`
 * sudah py dukungan native `multiple` + `Chips` (base-ui) -- field ini
 * murni pemakaian, bukan komponen primitif baru. Satu baris BOLEH py
 * >1 label sekaligus (keputusan 2026-10-09), tidak ada validasi bentrok
 * makna antar label di sini. */
export function LabelField<TFieldValues extends LabelFormValues>({
  control,
  scope,
  label,
  disabled,
}: LabelFieldProps<TFieldValues>) {
  const { data: labels } = useLabels(scope);
  const anchor = useComboboxAnchor();
  // Sama alasan cast di ContactField -- Path<TFieldValues> generik tidak
  // bisa disempitkan dari constraint TFieldValues extends LabelFormValues
  // saja, cast ini aman krn constraint itu menjamin field label_names ada
  // dgn tipe yang sama persis.
  const labelControl = control as unknown as Control<LabelFormValues>;
  const [query, setQuery] = useState("");

  const options: LabelOption[] = labels?.map((l) => ({ value: l.name, label: l.name })) ?? [];

  return (
    <Controller
      control={labelControl}
      name="label_names"
      render={({ field, fieldState }) => {
        const selectedNames = field.value ?? [];
        const trimmedQuery = query.trim();
        const hasExactMatch = options.some(
          (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase()
        );
        const alreadySelected = selectedNames.some(
          (name) => name.toLowerCase() === trimmedQuery.toLowerCase()
        );
        const showCreateOption = trimmedQuery.length > 0 && !hasExactMatch && !alreadySelected;
        const displayOptions: LabelOption[] = showCreateOption
          ? [...options, { value: `${CREATE_PREFIX}${trimmedQuery}`, label: trimmedQuery }]
          : options;

        const selectedItems: LabelOption[] = selectedNames.map((name) => ({ value: name, label: name }));

        return (
          <div className="space-y-2">
            <Label htmlFor="label_names">{label}</Label>
            <div ref={anchor}>
              <Combobox
                items={displayOptions}
                multiple
                value={selectedItems}
                onValueChange={(items: LabelOption[]) => {
                  field.onChange(items.map((item) => (item.value.startsWith(CREATE_PREFIX) ? item.label : item.value)));
                }}
                onInputValueChange={(value: string) => setQuery(value)}
                disabled={disabled}
              >
                <ComboboxChips>
                  {selectedItems.map((item) => (
                    <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
                  ))}
                  <ComboboxChipsInput id="label_names" placeholder="Cari atau ketik label baru..." disabled={disabled} />
                </ComboboxChips>
                <ComboboxContent anchor={anchor}>
                  <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
                  <ComboboxList>
                    {(item: LabelOption) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.value.startsWith(CREATE_PREFIX) ? `Buat label baru: "${item.label}"` : item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
          </div>
        );
      }}
    />
  );
}
