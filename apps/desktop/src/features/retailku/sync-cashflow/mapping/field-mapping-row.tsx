"use client";

import { RichTextEditor } from "@/components/rich-text";
import { Input } from "@/components/ui/input";
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
import type { AccountWithBalance } from "@/hooks/resources/use-accounts";
import type { Category } from "@/lib/db";
import type { MappingRowDraft } from "./hooks/use-mapping-draft";

// NEXT INI REFACTOR
type ComboboxOption = { value: string; label: string };

const NO_CATEGORY_OPTION: ComboboxOption = { value: "__none__", label: "Tanpa kategori" };

/** Form satu `key` mapping — akun (combobox, WAJIB), note/category/
 * description (semua OPSIONAL, kosong = fallback default saat sync,
 * lihat "Field fallback default" di
 * docs/todos/plan/retailku-sync-field-mapping.md). Dulu satu baris
 * tabel, sekarang isi satu tab (lihat field-mapping-tab.tsx) — makin
 * banyak key yang di-mapping TIDAK lagi menambah tinggi halaman. */
export function FieldMappingRow({
  row,
  localAccountOptions,
  categoryOptions,
  onChange,
}: {
  row: MappingRowDraft;
  localAccountOptions: AccountWithBalance[];
  categoryOptions: Category[];
  onChange: (patch: Partial<MappingRowDraft>) => void;
}) {
  const accountAnchor = useComboboxAnchor();
  const categoryAnchor = useComboboxAnchor();

  // Label menyertakan induk (grup akun / kategori induk) — beberapa
  // akun/kategori berbeda memakai nama yang sama persis, lihat pola
  // sama di use-account-category-options.tsx (form transaksi).
  const accountItems: ComboboxOption[] = localAccountOptions.map((account) => ({
    value: String(account.id),
    label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
  }));
  const selectedAccount = accountItems.find((item) => item.value === row.localAccountId?.toString()) ?? null;

  const categoryItems: ComboboxOption[] = [
    NO_CATEGORY_OPTION,
    ...categoryOptions.map((category) => {
      const parentName = categoryOptions.find((parent) => parent.id === category.parent_id)?.name;
      return {
        value: String(category.id),
        label: parentName ? `${category.name} — ${parentName}` : category.name,
      };
    }),
  ];
  const selectedCategory =
    categoryItems.find((item) => item.value === (row.categoryId?.toString() ?? NO_CATEGORY_OPTION.value)) ??
    NO_CATEGORY_OPTION;

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        <Label>Akun Tujuan</Label>
        <div ref={accountAnchor} className="min-w-0">
          <Combobox
            items={accountItems}
            value={selectedAccount}
            onValueChange={(item: ComboboxOption | null) =>
              onChange({ localAccountId: item ? Number(item.value) : null })
            }
          >
            <ComboboxInput placeholder="Pilih akun..." showClear className="w-full" />
            <ComboboxContent anchor={accountAnchor}>
              <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
              <ComboboxList>
                {(item: ComboboxOption) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <Label>Kategori</Label>
        <div ref={categoryAnchor} className="min-w-0">
          <Combobox
            items={categoryItems}
            value={selectedCategory}
            onValueChange={(item: ComboboxOption | null) =>
              onChange({
                categoryId:
                  !item || item.value === NO_CATEGORY_OPTION.value ? null : Number(item.value),
              })
            }
          >
            <ComboboxInput placeholder="Tanpa kategori" className="w-full" />
            <ComboboxContent anchor={categoryAnchor}>
              <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
              <ComboboxList>
                {(item: ComboboxOption) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>

      <div className="min-w-0 space-y-1.5 sm:col-span-2">
        <Label>Judul</Label>
        <Input
          value={row.note}
          placeholder="Judul default"
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </div>

      <div className="min-w-0 space-y-1.5 sm:col-span-2">
        <Label>Deskripsi</Label>
        <RichTextEditor
          value={row.description}
          onChange={(value) => onChange({ description: value })}
        />
      </div>
    </div>
  );
}
