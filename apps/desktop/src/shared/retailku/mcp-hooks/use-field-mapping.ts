"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

export const fieldMappingQueryKey = ["retailku", "field-mapping"];

export type FieldMapping = {
  key: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  retailkuAccountName: string;
  localAccountId: number;
  note: string | null;
  categoryId: number | null;
  description: string | null;
};

type FieldMappingRow = {
  key: string;
  retailku_account_id: string;
  retailku_account_code: string;
  retailku_account_name: string;
  local_account_id: number;
  note: string | null;
  category_id: number | null;
  description: string | null;
};

function mapRow(row: FieldMappingRow): FieldMapping {
  return {
    key: row.key,
    retailkuAccountId: row.retailku_account_id,
    retailkuAccountCode: row.retailku_account_code,
    retailkuAccountName: row.retailku_account_name,
    localAccountId: row.local_account_id,
    note: row.note,
    categoryId: row.category_id,
    description: row.description,
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
        `SELECT key, retailku_account_id, retailku_account_code, retailku_account_name,
                local_account_id, note, category_id, description
         FROM retailku_sync_field_mapping`
      );
      return rows.map(mapRow);
    },
  });
}

export type SaveFieldMappingInput = {
  key: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  retailkuAccountName: string;
  localAccountId: number;
  note: string | null;
  categoryId: number | null;
  description: string | null;
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
             (key, retailku_account_id, retailku_account_code, retailku_account_name,
              local_account_id, note, category_id, description, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET
             retailku_account_code = excluded.retailku_account_code,
             retailku_account_name = excluded.retailku_account_name,
             local_account_id = excluded.local_account_id,
             note = excluded.note,
             category_id = excluded.category_id,
             description = excluded.description,
             updated_at = excluded.updated_at`,
          [
            mapping.key,
            mapping.retailkuAccountId,
            mapping.retailkuAccountCode,
            mapping.retailkuAccountName,
            mapping.localAccountId,
            mapping.note,
            mapping.categoryId,
            mapping.description,
          ]
        );
      }
    },
    invalidateKey: [fieldMappingQueryKey, ["retailku", "account-mapping"]],
    successMessage: "Mapping berhasil disimpan",
    errorMessage: "Gagal menyimpan mapping",
  });
}
