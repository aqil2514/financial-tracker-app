"use client";

import { useState } from "react";
import { Controller, type Control, type FieldValues } from "react-hook-form";

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
import { useContacts } from "./use-contacts";
import { findSimilarContacts } from "./find-similar-contacts";

type ContactOption = { value: string; label: string };

const CREATE_PREFIX = "__create__:";

type ContactFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  label: string;
  disabled?: boolean;
  /** Nama field di form yang bertipe `string | null`, default
   * "contact_name" — dioper eksplisit kalau form punya LEBIH dari satu
   * field kontak (mis. form transfer third_party→third_party yang butuh
   * kontak asal & tujuan independen, lihat
   * docs/concept/konsep-dana-pihak-ketiga.md "Pindah tempat dan/atau
   * pindah kepemilikan"). TypeScript tidak bisa memverifikasi field yang
   * dipilih benar-benar `string | null` dari constraint generik `FieldValues`
   * saja (lihat cast contactControl) — tanggung jawab caller memastikan
   * nama field yang dioper memang bertipe itu di schema form-nya. */
  name?: string;
};

export function ContactField<TFieldValues extends FieldValues>({
  control,
  label,
  disabled,
  name = "contact_name",
}: ContactFieldProps<TFieldValues>) {
  const { data: contacts } = useContacts();
  const anchor = useComboboxAnchor();
  // Cast tujuannya menyederhanakan Path<TFieldValues> generik ke nama
  // field dinamis (string biasa) -- lihat catatan di `name` prop soal
  // tanggung jawab caller menjamin tipe field yang sebenarnya.
  const contactControl = control as unknown as Control<Record<string, string | null>>;
  const [query, setQuery] = useState("");

  const options: ContactOption[] =
    contacts?.map((contact) => ({
      value: contact.name,
      label: contact.name,
    })) ?? [];

  const trimmedQuery = query.trim();
  const hasExactMatch = options.some(
    (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCreateOption = trimmedQuery.length > 0 && !hasExactMatch;
  const displayOptions: ContactOption[] = showCreateOption
    ? [...options, { value: `${CREATE_PREFIX}${trimmedQuery}`, label: trimmedQuery }]
    : options;

  return (
    <Controller
      control={contactControl}
      name={name}
      render={({ field, fieldState }) => {
        const similar = contacts
          ? findSimilarContacts(field.value ?? "", contacts)
          : [];

        const selected = field.value
          ? { value: field.value, label: field.value }
          : null;

        return (
          <div className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            <div ref={anchor}>
              <Combobox
                items={displayOptions}
                value={selected}
                onValueChange={(item: ContactOption | null) => {
                  if (!item) {
                    field.onChange(null);
                    return;
                  }
                  const isCreate = item.value.startsWith(CREATE_PREFIX);
                  field.onChange(isCreate ? item.label : item.value);
                }}
                onInputValueChange={(value: string) => setQuery(value)}
              >
                <ComboboxInput
                  id={name}
                  placeholder="Cari atau ketik nama baru..."
                  showClear
                  disabled={disabled}
                />
                <ComboboxContent anchor={anchor}>
                  <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
                  <ComboboxList>
                    {(item: ContactOption) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.value.startsWith(CREATE_PREFIX)
                          ? `Buat kontak baru: "${item.label}"`
                          : item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            {similar.length > 0 && (
              <p className="text-amber-600 text-sm dark:text-amber-500">
                Mirip dengan kontak yang sudah ada:{" "}
                {similar.map((contact) => contact.name).join(", ")}. Pastikan ini
                bukan typo sebelum menyimpan.
              </p>
            )}
            {disabled && (
              <p className="text-muted-foreground text-sm">
                Piutang ini sudah menerima cicilan dari transaksi lain — kontak,
                nominal, dan akun tidak bisa diubah dari sini supaya riwayat
                cicilannya tidak hilang.
              </p>
            )}
            {fieldState.error && (
              <p className="text-destructive text-sm">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
