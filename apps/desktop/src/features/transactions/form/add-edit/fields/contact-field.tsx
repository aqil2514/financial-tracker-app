"use client";

import { useState } from "react";
import { Controller, type Control } from "react-hook-form";

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
import { useContacts } from "@/shared/contacts/use-contacts";
import { findSimilarContacts } from "@/shared/contacts/find-similar-contacts";

type ContactOption = { value: string; label: string };

const CREATE_PREFIX = "__create__:";

/** Bentuk minimal form yang dibutuhkan field ini — dipakai bareng oleh
 * form transaksi (`transaction.schema.ts`) dan form-form lain yang juga
 * punya field kontak (mis. `new-debt-form`). */
type ContactFormValues = { contact_name: string | null };

type ContactFieldProps<TFieldValues extends ContactFormValues> = {
  control: Control<TFieldValues>;
  label: string;
  disabled?: boolean;
};

export function ContactField<TFieldValues extends ContactFormValues>({
  control,
  label,
  disabled,
}: ContactFieldProps<TFieldValues>) {
  const { data: contacts } = useContacts();
  const anchor = useComboboxAnchor();
  // react-hook-form tidak bisa menyempitkan Path<TFieldValues> generik ke
  // literal "contact_name" hanya dari constraint TFieldValues extends
  // ContactFormValues — cast ini aman karena constraint itu menjamin
  // field contact_name ada dengan tipe yang sama persis.
  const contactControl = control as unknown as Control<ContactFormValues>;
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
      name="contact_name"
      render={({ field, fieldState }) => {
        const similar = contacts
          ? findSimilarContacts(field.value ?? "", contacts)
          : [];

        const selected = field.value
          ? { value: field.value, label: field.value }
          : null;

        return (
          <div className="space-y-2">
            <Label htmlFor="contact_name">{label}</Label>
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
                  id="contact_name"
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
