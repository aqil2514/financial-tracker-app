"use client";

import { Label } from "@/components/ui/label";
import {
  FormFieldCombobox,
  FormFieldRichText,
  FormFieldText,
} from "@/components/forms/form-fields";
import type { Category } from "@/lib/db";
import type { RetailkuFundTransferDetail } from "@/shared/retailku/mcp-tools";
import type { MappingRowDraftPatch, TransferMappingRowDraft } from "../../context/interfaces";
import { FollowSourceToggle } from "../follow-source-toggle";
import {
  categoryOptionsToComboboxItems,
  useFundTransferMappingForm,
} from "./use-fund-transfer-mapping-form";

const NO_CATEGORY_OPTION = { value: "__none__", label: "Tanpa kategori" };

/** Form mapping utk `sourceType: FUND_TRANSFER` — 2 dropdown akun lokal
 * ("Dari"/"Ke") + note/kategori/deskripsi (SAMA field non-fakta yg
 * dipakai varian generic, lihat `GenericMappingRow`) + toggle
 * "Mengikuti Retailku". SAMA pola dgn `GenericMappingRow`: TIDAK ada
 * tombol submit sendiri, `onChange` melapor ke `updateDraft` Context,
 * tombol "Simpan Mapping" GLOBAL yg submit sekali utk semua key
 * (generic+transfer sekaligus) — lihat `use-mapping-draft-save.ts`.
 * SEBELUMNYA PoC berdiri sendiri dgn tombol submit console.log —
 * DISATUKAN ke pola generic 2026-09-28 setelah skema DB siap
 * (`secondary_account_id` migrasi 0023, `extra_fields` migrasi 0024).
 *
 * `retailkuDetail` (opsional) menampilkan referensi READ-ONLY data
 * transfer ASLI dari Retailku (fromAccount/toAccount/transferAmount)
 * supaya user tahu transaksi mana yg sedang di-mapping — TIDAK
 * mengunci pilihan akun lokal (akun lokal bisa akun kas MANAPUN,
 * bukan cuma 1 akun generik, lihat latar belakang di
 * docs/todos/plan/retailku-dynamic-sourcetype-mapping.md). */
export function FundTransferMappingForm({
  row,
  categoryOptions,
  onChange,
  retailkuDetail,
}: {
  row: TransferMappingRowDraft;
  categoryOptions: Category[];
  onChange: (patch: MappingRowDraftPatch) => void;
  retailkuDetail?: RetailkuFundTransferDetail;
}) {
  const { form, cashAccountOptions, fromAccountId, noteFollowSource, descriptionFollowSource } =
    useFundTransferMappingForm({ row, onChange });

  const categoryItems = [NO_CATEGORY_OPTION, ...categoryOptionsToComboboxItems(categoryOptions)];

  return (
    <div className="space-y-4">
      {retailkuDetail && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Referensi transaksi Retailku</p>
          <p className="text-muted-foreground">
            {retailkuDetail.fromAccount.name} ({retailkuDetail.fromAccount.code}) →{" "}
            {retailkuDetail.toAccount.name} ({retailkuDetail.toAccount.code}) — Rp{" "}
            {retailkuDetail.transferAmount.toLocaleString("id-ID")}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormFieldCombobox
          form={form}
          name="fromAccountId"
          label="Dari Akun (lokal)"
          placeholder="Cari akun kas..."
          options={cashAccountOptions}
        />

        <FormFieldCombobox
          form={form}
          name="toAccountId"
          label="Ke Akun (lokal)"
          placeholder="Cari akun kas..."
          options={cashAccountOptions.filter((option) => option.value !== fromAccountId)}
          disabled={!fromAccountId}
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
    </div>
  );
}
