"use client";

import { Button } from "@/components/ui/button";
import { FormFieldCombobox } from "@/components/forms/form-fields";
import type { RetailkuFundTransferDetail } from "@/shared/retailku/mcp-tools";
import { useFundTransferMappingForm } from "./use-fund-transfer-mapping-form";

/** PoC form mapping utk `sourceType: FUND_TRANSFER` — 2 dropdown akun
 * lokal ("Dari"/"Ke"), MENGIKUTI pola render existing
 * (`transactions/form/add-edit`: wrapper `form-fields`, BUKAN
 * `<FormField>` shadcn telanjang) meski skema validasinya
 * `discriminatedUnion` (beda layer, lihat schema.ts). Komponen
 * TERPISAH dari tab Mapping existing (`field-mapping-row.tsx`) —
 * proof of concept, belum diintegrasikan.
 *
 * `retailkuDetail` (opsional) menampilkan referensi READ-ONLY data
 * transfer ASLI dari Retailku (fromAccount/toAccount/transferAmount)
 * supaya user tahu transaksi mana yg sedang di-mapping — TIDAK
 * mengunci pilihan akun lokal (akun lokal bisa akun kas MANAPUN,
 * bukan cuma 1 akun generik, lihat latar belakang di
 * docs/todos/plan/retailku-dynamic-sourcetype-mapping.md). */
export function FundTransferMappingForm({
  mappingKey,
  retailkuDetail,
}: {
  mappingKey: string;
  retailkuDetail?: RetailkuFundTransferDetail;
}) {
  const { form, cashAccountOptions, fromAccountId, toAccountId, handleSubmit } =
    useFundTransferMappingForm(mappingKey);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <Button type="submit" disabled={!fromAccountId || !toAccountId}>
        Simpan (PoC — console.log saja)
      </Button>
    </form>
  );
}
