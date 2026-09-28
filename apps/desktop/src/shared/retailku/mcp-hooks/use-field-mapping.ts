"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

export const fieldMappingQueryKey = ["retailku", "field-mapping"];

/** Bentuk `extra_fields` (JSON) — SATU tipe gabungan lintas
 * `source_kind` (bukan tipe terpisah per kind, biar tetap 1 kolom
 * fleksibel tanpa migrasi berulang, lihat migrasi 0024). Field baru
 * TAMBAH di sini seiring kebutuhan, SEMUA opsional — baris yang tidak
 * relevan cukup tidak mengisi field itu. */
export type FieldMappingExtraFields = {
  /** `true` = `note` transaksi hasil sync IKUT `description` transaksi
   * ASLI Retailku (per transaksi, BUKAN nilai statis `note` mapping
   * ini) — cuma relevan `source_kind: "transfer"` sekarang. */
  noteFollowSource?: boolean;
  /** Sama seperti `noteFollowSource`, utk field `description`. */
  descriptionFollowSource?: boolean;
  /** Kontak LOKAL FALLBACK — cuma relevan `source_kind: "AR_AP"`,
   * dipakai HANYA saat `contactFollowSource` OFF. Bukan kolom eksplisit
   * (`contacts.id` bukan akun, jadi tidak cocok di
   * `local_account_id`/`secondary_account_id`) — keputusan SADAR
   * 2026-09-28, konsisten dgn alasan JSON dipakai utk `noteFollowSource`
   * dkk: makin banyak field spesifik per `sourceKind`, kolom eksplisit
   * akan TERUS MENUMPUK. */
  contactId?: number;
  /** `true` = kontak transaksi hasil sync IKUT nama PIHAK ASLI Retailku
   * PER TRANSAKSI (bukan `contactId` statis di atas) — cuma relevan
   * `source_kind: "AR_AP"`. SAMA konsep `noteFollowSource`/
   * `descriptionFollowSource`, tapi utk kontak — relevan KHUSUS AR_AP
   * karena 1 key di sana BISA mewakili BANYAK pihak berbeda sekaligus. */
  contactFollowSource?: boolean;
};

export type FieldMapping = {
  key: string;
  /** Klasifikasi baris — SAMA istilah dgn `MappingRowDraft.sourceType`
   * di kode TS ("generic"/"FUND_TRANSFER"/dst, lihat migrasi 0024 utk
   * alasan kolom ini ADA drpd cuma parsing `key`). Disimpan sbg string
   * bebas di DB (`source_kind`), di-widen ke sini APA ADANYA — validasi
   * nilai yang dikenal ada di level pemanggil (`use-mapping-candidates.ts`). */
  sourceKind: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  retailkuAccountName: string;
  localAccountId: number;
  /** Akun kedua (mis. `toAccountId` FUND_TRANSFER) — `null` utk key yang
   * cukup 1 akun (mapping generik), lihat migrasi 0023. */
  secondaryAccountId: number | null;
  note: string | null;
  categoryId: number | null;
  description: string | null;
  extraFields: FieldMappingExtraFields;
};

type FieldMappingRow = {
  key: string;
  source_kind: string;
  retailku_account_id: string;
  retailku_account_code: string;
  retailku_account_name: string;
  local_account_id: number;
  secondary_account_id: number | null;
  note: string | null;
  category_id: number | null;
  description: string | null;
  extra_fields: string | null;
};

function parseExtraFields(raw: string | null): FieldMappingExtraFields {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as FieldMappingExtraFields;
  } catch {
    return {};
  }
}

function mapRow(row: FieldMappingRow): FieldMapping {
  return {
    key: row.key,
    sourceKind: row.source_kind,
    retailkuAccountId: row.retailku_account_id,
    retailkuAccountCode: row.retailku_account_code,
    retailkuAccountName: row.retailku_account_name,
    localAccountId: row.local_account_id,
    secondaryAccountId: row.secondary_account_id,
    note: row.note,
    categoryId: row.category_id,
    description: row.description,
    extraFields: parseExtraFields(row.extra_fields),
  };
}

/**
 * Mapping field non-fakta (note/category_id/description) + akun tujuan
 * per `key`, lihat docs/todos/plan/retailku-sync-field-mapping.md. Beda
 * dari `useRetailkuAccountMapping` (ringkasan per-akun, dipakai badge
 * sidebar/deteksi orphan yang levelnya masih per akun) — hook ini
 * mengembalikan SEMUA baris apa adanya (levelnya per key, termasuk
 * arah/sourceType), dipakai UI tab Mapping yang baru.
 */
export function useFieldMapping() {
  return useQuery({
    queryKey: fieldMappingQueryKey,
    queryFn: async (): Promise<FieldMapping[]> => {
      const db = await getDb();
      const rows = await db.select<FieldMappingRow[]>(
        `SELECT key, source_kind, retailku_account_id, retailku_account_code, retailku_account_name,
                local_account_id, secondary_account_id, note, category_id, description, extra_fields
         FROM retailku_sync_field_mapping`
      );
      return rows.map(mapRow);
    },
  });
}

export type SaveFieldMappingInput = {
  key: string;
  sourceKind: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  retailkuAccountName: string;
  localAccountId: number;
  secondaryAccountId: number | null;
  note: string | null;
  categoryId: number | null;
  description: string | null;
  extraFields: FieldMappingExtraFields;
}[];

/**
 * Simpan/update mapping sekaligus (satu baris per `key` yang diubah di
 * UI). UPSERT by `key` (UNIQUE) — pola sama dengan
 * `useSaveRetailkuAccountMapping` lama, cuma field-nya lebih banyak.
 */
export function useSaveFieldMapping() {
  return useDbMutation({
    mutationFn: async (mappings: SaveFieldMappingInput) => {
      const db = await getDb();
      for (const mapping of mappings) {
        await db.execute(
          `INSERT INTO retailku_sync_field_mapping
             (key, source_kind, retailku_account_id, retailku_account_code, retailku_account_name,
              local_account_id, secondary_account_id, note, category_id, description, extra_fields, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET
             source_kind = excluded.source_kind,
             retailku_account_code = excluded.retailku_account_code,
             retailku_account_name = excluded.retailku_account_name,
             local_account_id = excluded.local_account_id,
             secondary_account_id = excluded.secondary_account_id,
             note = excluded.note,
             category_id = excluded.category_id,
             description = excluded.description,
             extra_fields = excluded.extra_fields,
             updated_at = excluded.updated_at`,
          [
            mapping.key,
            mapping.sourceKind,
            mapping.retailkuAccountId,
            mapping.retailkuAccountCode,
            mapping.retailkuAccountName,
            mapping.localAccountId,
            mapping.secondaryAccountId,
            mapping.note,
            mapping.categoryId,
            mapping.description,
            Object.keys(mapping.extraFields).length > 0 ? JSON.stringify(mapping.extraFields) : null,
          ]
        );
      }
    },
    invalidateKey: [fieldMappingQueryKey, ["retailku", "account-mapping"]],
    successMessage: "Mapping berhasil disimpan",
    errorMessage: "Gagal menyimpan mapping",
  });
}
