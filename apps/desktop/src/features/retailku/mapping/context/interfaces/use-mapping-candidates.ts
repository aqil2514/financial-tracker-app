import { useLoadMappingKeys } from "../hooks/use-load-mapping-keys";
import { useLoadTransferMappingKeys } from "../hooks/use-load-transfer-mapping-keys";
import { useLoadArApMappingKeys } from "../hooks/use-load-ar-ap-mapping-keys";
import { RetailkuCashflowSyncMode } from ".";
import type { MappingRowDraftPatch } from "./use-draft-state";

import { JSONContent } from "@tiptap/react";

export interface UseMappingCandidatesInput {
  loadKeys: ReturnType<typeof useLoadMappingKeys>;
  loadTransferKeys: ReturnType<typeof useLoadTransferMappingKeys>;
  loadArApKeys: ReturnType<typeof useLoadArApMappingKeys>;
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

/** Baris mapping AR_AP — key PER AKUN JURNAL Retailku
 * (`ar_ap:<accountId>:<direction>`, lihat `extract-ar-ap-rows.ts`),
 * SAMA pola persis dgn key generic — cuma 1-2 baris total per toko
 * (data nyata Warung Aqil 2026-09: "Piutang Dagang"/"Hutang ke
 * Penitip"). Key PER PIHAK sempat dicoba 2026-09-28, DIBATALKAN: pihak
 * bebas berpindah metode bayar kapan saja (mis. hari ini Kas Tunai,
 * besok Transfer Bank utk pihak yang SAMA) — beda sifat dari pasangan
 * akun transfer yang memang STABIL, jadi tidak cocok jadi identitas
 * key (lihat JSDoc `buildArApMappingKey`).
 *
 * BEDA dari `TransferMappingRowDraft`: HANYA 1 akun lokal
 * (`localAccountId`, akun DEBT tujuan piutang/utang ini dicatat) —
 * TIDAK ADA field akun kas di form ini sama sekali. Akun kas sisi
 * pelunasan itu di LUAR SCOPE mapping ini (jalur sync AR/AP yang
 * BELUM dibangun — `insertArApTransaction` MASIH pakai 1 akun kas
 * statis dari config lama sampai sekarang), TIDAK diklaim
 * terselesaikan di sini. `secondaryAccountId` TIDAK dipakai varian ini
 * (selalu `null`, kolomnya cuma relevan utk `TransferMappingRowDraft`).
 *
 * `contactId` (kontak LOKAL FALLBACK, dipakai `applyDebtTransaction`
 * saat `contactFollowSource` OFF) disimpan di `extraFields` (BUKAN
 * kolom eksplisit — keputusan SADAR, konsisten dgn alasan JSON dipakai
 * `noteFollowSource`/`descriptionFollowSource`).
 *
 * TIDAK ADA `categoryId` di sini (BEDA dari generic/transfer) — kategori
 * cuma berlaku utk `type: income/expense` (lihat `category.schema.ts`:
 * `type: z.enum(["income","expense"])`, TIDAK ADA "transfer"), sedangkan
 * SEMUA transaksi AR/AP SELALU `type: transfer`
 * (`insert-ar-ap-transaction.ts`, sama seperti jalur native
 * `apply-debt-transaction.ts`/`use-create-debt.ts`/`use-pay-debt.ts` yang
 * SELALU `category_id: NULL`, dan form transaksi native
 * `transaction-form.tsx` MENYEMBUNYIKAN field kategori begitu
 * `type === "transfer"`). Sempat ikut ditambahkan di sini (copy dari
 * varian generic), DIHAPUS 2026-09-28 setelah dicek `insertTransferTransaction`
 * (dipakai `insertArApTransaction`) TIDAK PERNAH menyimpan `category_id`
 * — field itu jadi dead data kalau tetap ada. */
export interface ArApMappingRowDraft {
  key: string;
  sourceType: "AR_AP";
  accountName: string;
  direction: "receivable" | "payable";
  /** Jumlah transaksi piutang/utang dgn akun+arah ini di rentang
   * tanggal yg dimuat — MURNI tampilan, TIDAK mempengaruhi `key`. */
  transactionCount: number;
  /** Nama-nama PIHAK (dedupe) yang muncul di transaksi dgn key ini —
   * MURNI tampilan (key ini SERING mewakili banyak pihak berbeda,
   * bukan cuma banyak transaksi 1 pihak), TIDAK mempengaruhi `key`. */
  partyNames: string[];
  /** Akun DEBT lokal (piutang/utang) — NOT NULL di skema DB, jadi
   * `null` di sini berarti "belum dipetakan user" (SAMA makna dgn
   * varian lain), BUKAN representasi "akun kas" seperti nama field ini
   * di varian generic/transfer. */
  localAccountId: number | null;
  /** Kontak LOKAL FALLBACK — dipakai HANYA saat `contactFollowSource`
   * OFF (SAMA konsep `note`/`description` statis di varian lain saat
   * toggle-nya OFF). `null` = belum dipilih user. TIDAK di kolom
   * `local...`/`secondary...` (keduanya utk akun, bukan kontak) —
   * disimpan `extraFields.contactId` saat submit. */
  contactId: number | null;
  /** `true` = kontak transaksi hasil sync IKUT nama PIHAK ASLI Retailku
   * (`ArApRow.partyName`) PER TRANSAKSI (bisa beda-beda tiap transaksi,
   * SESUAI pihak yg sebenarnya bertransaksi) — BUKAN 1 kontak statis
   * `contactId` di atas. SAMA konsep persis `noteFollowSource`/
   * `descriptionFollowSource` (migrasi 0024, `extra_fields`), tapi utk
   * KONTAK — relevan KHUSUS AR_AP karena 1 key di sini BISA mewakili
   * BANYAK pihak berbeda (lihat `partyNames`), beda dari generic/
   * transfer yang toggle-nya utk note/description. */
  contactFollowSource: boolean;
  note: string;
  description: JSONContent | null;
}

/** Discriminated union by `sourceType` — SATU daftar `rows` gabungan
 * generic+transfer+ar_ap (dan `sourceType` spesial lain nanti), dipakai
 * baik `MappingOverviewPanel` (narrowing per varian di JSX) maupun
 * `form/index.ts` (`FlexRenderForm`, switch by `sourceType`). */
export type MappingRowDraft = GenericMappingRowDraft | TransferMappingRowDraft | ArApMappingRowDraft;
