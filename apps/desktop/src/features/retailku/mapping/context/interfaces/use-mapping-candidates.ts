import { useLoadMappingKeys } from "../hooks/use-load-mapping-keys";
import { useLoadTransferMappingKeys } from "../hooks/use-load-transfer-mapping-keys";
import { RetailkuCashflowSyncMode } from ".";
import type { MappingRowDraftPatch } from "./use-draft-state";

import { JSONContent } from "@tiptap/react";

export interface UseMappingCandidatesInput {
  loadKeys: ReturnType<typeof useLoadMappingKeys>;
  loadTransferKeys: ReturnType<typeof useLoadTransferMappingKeys>;
  mode: RetailkuCashflowSyncMode;
  drafts: Record<string, MappingRowDraftPatch>;
}

export interface UseMappingCandidatesOutput {
  rows: MappingRowDraft[];
}

/** Baris mapping generik (akun tunggal) — SEMUA `sourceType` yang tidak
 * butuh skema spesial (SALE biasa, dst), lihat
 * docs/todos/plan/retailku-dynamic-sourcetype-mapping.md.
 *
 * PENTING — baris ini adalah AGREGAT (satu key = gabungan BANYAK
 * transaksi Retailku, mis. `detail:<akun>:OPERATIONAL_EXPENSE:outflow`
 * menggabungkan "Server Retailku"/Beban Operasional DAN "Amal"/Beban
 * Amal dan Zakat jadi satu key, dibuktikan data nyata toko Warung Aqil
 * 2026-09, lihat handover 2026-09-28) — `note`/`description` statis di
 * sini otomatis SAMA utk SEMUA transaksi yg tergabung, kehilangan
 * detail "beban ini utk apa" per transaksi. `noteFollowSource`/
 * `descriptionFollowSource` (SAMA konsep dgn `TransferMappingRowDraft`)
 * mengatasi ini — nilai statis di bawah TETAP fallback kalau toggle
 * OFF. */
export interface GenericMappingRowDraft {
  key: string;
  sourceType: "generic";
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  localAccountId: number | null;
  note: string;
  categoryId: number | null;
  description: JSONContent | null; //Buat render deskripsi (Dari tiptap Rich Text Editor)
  /** `true` = `note`/`description` hasil sync IKUT `description`
   * transaksi ASLI Retailku (`RetailkuCashflowDetailRow.description`)
   * per transaksi individual (bukan nilai statis di atas) — disimpan
   * di `extra_fields` (migrasi 0024), lihat `FieldMappingExtraFields`. */
  noteFollowSource: boolean;
  descriptionFollowSource: boolean;
}

/** Baris mapping FUND_TRANSFER — key PER PASANGAN akun Retailku
 * (`transfer:<fromAccountId>:<toAccountId>`, lihat
 * `extract-transfer-rows.ts`), BUKAN per transaksi — 1 mapping berlaku
 * utk SEMUA transfer dgn pasangan akun yg sama. 2 akun lokal (dari+ke)
 * + note/categoryId/description — SAMA seperti varian generic (lihat
 * `transactions/form/add-edit/schema.ts`: `note` WAJIB utk SEMUA tipe
 * transaksi TERMASUK transfer, `description`/`category_id` juga
 * berlaku; klaim awal PoC "transfer tidak butuh field ini" KELIRU,
 * dikoreksi user 2026-09-28). `secondaryAccountId` null berarti
 * `toAccountId` belum dipetakan user, sama makna dgn `localAccountId`
 * null di varian generic. */
export interface TransferMappingRowDraft {
  key: string;
  sourceType: "FUND_TRANSFER";
  fromAccountName: string;
  toAccountName: string;
  /** Jumlah transaksi transfer dgn pasangan akun ini di rentang tanggal
   * yg dimuat — MURNI tampilan, TIDAK mempengaruhi `key`. */
  transactionCount: number;
  localAccountId: number | null;
  secondaryAccountId: number | null;
  note: string;
  categoryId: number | null;
  description: JSONContent | null;
  /** `true` = `note`/`description` hasil sync IKUT `description`
   * transaksi ASLI Retailku per transaksi (bukan nilai statis di
   * `note`/`description` field ini) — disimpan di `extra_fields`
   * (migrasi 0024), lihat `FieldMappingExtraFields`. Field `note`/
   * `description` di atas TETAP ada sbg FALLBACK saat toggle OFF, TIDAK
   * dihapus saat toggle ON (biar user bisa matikan toggle lagi tanpa
   * kehilangan nilai yg sudah diisi). */
  noteFollowSource: boolean;
  descriptionFollowSource: boolean;
}

/** Discriminated union by `sourceType` — SATU daftar `rows` gabungan
 * generic+transfer (dan `sourceType` spesial lain nanti), dipakai baik
 * `MappingOverviewPanel` (narrowing per varian di JSX) maupun
 * `form/index.ts` (`FlexRenderForm`, switch by `sourceType`). */
export type MappingRowDraft = GenericMappingRowDraft | TransferMappingRowDraft;
