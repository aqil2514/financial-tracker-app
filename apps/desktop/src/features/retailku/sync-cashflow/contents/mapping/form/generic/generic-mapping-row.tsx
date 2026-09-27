"use client";

import { Label } from "@/components/ui/label";
import {
  FormFieldCombobox,
  FormFieldRichText,
  FormFieldText,
} from "@/components/forms/form-fields";
import type { AccountWithBalance } from "@/hooks/resources/use-accounts";
import type { Category } from "@/lib/db";
import type { GenericMappingRowDraft, MappingRowDraftPatch } from "../../context/interfaces";
import { FollowSourceToggle } from "../follow-source-toggle";
import { useGenericMappingForm } from "./use-generic-mapping-form";

const NO_CATEGORY_OPTION = { value: "__none__", label: "Tanpa kategori" };

/** Form satu `key` mapping generik — akun (combobox, WAJIB), note/
 * category/description (semua OPSIONAL, kosong = fallback default saat
 * sync, lihat "Field fallback default" di
 * docs/todos/plan/retailku-sync-field-mapping.md) + toggle "Mengikuti
 * Retailku" (SAMA konsep dgn `FundTransferMappingForm`, lihat JSDoc
 * `GenericMappingRowDraft` — baris ini AGREGAT, bisa mewakili banyak
 * transaksi Retailku berbeda, dibuktikan data nyata OPERATIONAL_EXPENSE
 * toko Warung Aqil 2026-09 menggabungkan "Server Retailku"/Beban
 * Operasional & "Amal"/Beban Amal dan Zakat jadi 1 key). Migrasi dari
 * `field-mapping-row.tsx` (draft-state manual) ke RHF+Zod (lihat
 * `use-generic-mapping-form.ts`) — perilaku simpan TIDAK berubah,
 * tombol "Simpan Mapping" tetap 1 utk semua key sekaligus. */
export function GenericMappingRow({
  row,
  localAccountOptions,
  categoryOptions,
  onChange,
}: {
  row: GenericMappingRowDraft;
  localAccountOptions: AccountWithBalance[];
  categoryOptions: Category[];
  onChange: (patch: MappingRowDraftPatch) => void;
}) {
  const { form, noteFollowSource, descriptionFollowSource } = useGenericMappingForm({ row, onChange });

  const accountItems = localAccountOptions.map((account) => ({
    value: String(account.id),
    label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
  }));

  const categoryItems = [
    NO_CATEGORY_OPTION,
    ...categoryOptions.map((category) => {
      const parentName = categoryOptions.find((parent) => parent.id === category.parent_id)?.name;
      return {
        value: String(category.id),
        label: parentName ? `${category.name} — ${parentName}` : category.name,
      };
    }),
  ];

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <FormFieldCombobox
        form={form}
        name="localAccountId"
        label="Akun Tujuan"
        placeholder="Pilih akun..."
        options={accountItems}
        allowClear
      />

      <FormFieldCombobox
        form={form}
        name="categoryId"
        label="Kategori"
        placeholder="Tanpa kategori"
        options={categoryItems}
      />

      <div className="sm:col-span-2 space-y-2">
        <FormFieldText
          form={form}
          name="note"
          label="Judul"
          placeholder={noteFollowSource ? "(ikut deskripsi tiap transaksi Retailku)" : "Judul default"}
          disabled={noteFollowSource}
        />
        <FollowSourceToggle
          form={form}
          name="noteFollowSource"
          label="Mengikuti Retailku (judul ikut deskripsi tiap transaksi)"
        />
      </div>

      <div className="sm:col-span-2 space-y-2">
        {descriptionFollowSource ? (
          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              (ikut deskripsi tiap transaksi Retailku)
            </p>
          </div>
        ) : (
          <FormFieldRichText form={form} name="description" label="Deskripsi" />
        )}
        <FollowSourceToggle
          form={form}
          name="descriptionFollowSource"
          label="Mengikuti Retailku (deskripsi ikut deskripsi tiap transaksi)"
        />
      </div>
    </div>
  );
}
