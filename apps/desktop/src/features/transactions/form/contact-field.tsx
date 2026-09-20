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
import type { TransactionFormValues } from "./transaction.schema";

type ContactOption = { value: string; label: string };

const CREATE_PREFIX = "__create__:";

type ContactFieldProps = {
  control: Control<TransactionFormValues>;
  label: string;
  disabled?: boolean;
};

export function ContactField({ control, label, disabled }: ContactFieldProps) {
  const { data: contacts } = useContacts();
  const anchor = useComboboxAnchor();
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
      control={control}
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
            {fieldState.error && (
              <p className="text-destructive text-sm">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
