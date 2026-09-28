"use client";

import type { AccountWithBalance } from "@/hooks/resources/use-accounts";
import type { Category, Contact } from "@/lib/db";
import type { MappingRowDraft, MappingRowDraftPatch } from "../context/interfaces";
import { GenericMappingRow } from "./generic/generic-mapping-row";
import { FundTransferMappingForm } from "./fund-transfer/fund-transfer-mapping-form";
import { ArApMappingForm } from "./ar-ap/ar-ap-mapping-form";

/** Pilih form mapping yang benar berdasar `row.sourceType` — SATU
 * titik render dipakai `MappingField` (bukan pemanggil langsung tiap
 * varian) supaya menambah `sourceType` spesial baru (CONSIGNMENT_
 * SETTLEMENT, dst) cukup nambah 1 `case` di sini, lihat
 * docs/todos/plan/retailku-dynamic-sourcetype-mapping.md.
 *
 * SEMUA varian (generic, FUND_TRANSFER, AR_AP) SEKARANG live-sync ke
 * `updateDraft` lewat `onChange` yang SAMA — tombol "Simpan Mapping"
 * GLOBAL (`use-mapping-draft-save.ts`) menyimpan SEMUA varian sekaligus
 * ke `retailku_sync_field_mapping`, TIDAK ada lagi tombol submit
 * terpisah per-form (status PoC `FundTransferMappingForm` SELESAI
 * 2026-09-28). */
export function FlexRenderForm({
  row,
  localAccountOptions,
  debtAccountOptions,
  contactOptions,
  categoryOptions,
  onChange,
}: {
  row: MappingRowDraft;
  localAccountOptions: AccountWithBalance[];
  debtAccountOptions: AccountWithBalance[];
  contactOptions: Contact[];
  categoryOptions: Category[];
  onChange: (patch: MappingRowDraftPatch) => void;
}) {
  switch (row.sourceType) {
    case "FUND_TRANSFER":
      return <FundTransferMappingForm row={row} categoryOptions={categoryOptions} onChange={onChange} />;
    case "AR_AP":
      return (
        <ArApMappingForm
          row={row}
          debtAccountOptions={debtAccountOptions}
          contactOptions={contactOptions}
          onChange={onChange}
        />
      );
    case "generic":
    default:
      return (
        <GenericMappingRow
          row={row}
          localAccountOptions={localAccountOptions}
          categoryOptions={categoryOptions}
          onChange={onChange}
        />
      );
  }
}
