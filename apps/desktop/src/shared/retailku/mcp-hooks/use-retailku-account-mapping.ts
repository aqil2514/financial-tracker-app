"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

export const retailkuAccountMappingQueryKey = ["retailku", "account-mapping"];

export type RetailkuAccountMapping = {
  id: number;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  retailkuAccountName: string;
  localAccountId: number;
};

type RetailkuAccountMappingRow = {
  id: number;
  retailku_account_id: string;
  retailku_account_code: string;
  retailku_account_name: string;
  local_account_id: number;
};

function mapRow(row: RetailkuAccountMappingRow): RetailkuAccountMapping {
  return {
    id: row.id,
    retailkuAccountId: row.retailku_account_id,
    retailkuAccountCode: row.retailku_account_code,
    retailkuAccountName: row.retailku_account_name,
    localAccountId: row.local_account_id,
  };
}

/**
 * Mapping akun Retailku (payment method) -> akun lokal `financial-app`,
 * lihat docs/todos/plan/retailku-account-mapping.md. Dikunci ke
 * `retailkuAccountId` (UUID stabil dari Retailku, lihat
 * "Stabilitas retailku_account_id" di dokumen tsb) — bukan code/name.
 */
export function useRetailkuAccountMapping() {
  return useQuery({
    queryKey: retailkuAccountMappingQueryKey,
    queryFn: async (): Promise<RetailkuAccountMapping[]> => {
      const db = await getDb();
      const rows = await db.select<RetailkuAccountMappingRow[]>(
        "SELECT id, retailku_account_id, retailku_account_code, retailku_account_name, local_account_id FROM retailku_account_mapping"
      );
      return rows.map(mapRow);
    },
  });
}

export type SaveRetailkuAccountMappingInput = {
  retailkuAccountId: string;
  retailkuAccountCode: string;
  retailkuAccountName: string;
  localAccountId: number;
}[];

/**
 * Simpan/update mapping akun sekaligus (satu baris per akun Retailku
 * yang dipilih di UI). UPSERT by `retailku_account_id` (UNIQUE) supaya
 * re-mapping (ganti akun lokal tujuan) meng-update baris yang sudah
 * ada, bukan membuat baris baru — lihat "Re-mapping" di dokumen desain.
 */
export function useSaveRetailkuAccountMapping() {
  return useDbMutation({
    mutationFn: async (mappings: SaveRetailkuAccountMappingInput) => {
      const db = await getDb();
      for (const mapping of mappings) {
        await db.execute(
          `INSERT INTO retailku_account_mapping
             (retailku_account_id, retailku_account_code, retailku_account_name, local_account_id, updated_at)
           VALUES ($1, $2, $3, $4, datetime('now'))
           ON CONFLICT(retailku_account_id) DO UPDATE SET
             retailku_account_code = excluded.retailku_account_code,
             retailku_account_name = excluded.retailku_account_name,
             local_account_id = excluded.local_account_id,
             updated_at = excluded.updated_at`,
          [
            mapping.retailkuAccountId,
            mapping.retailkuAccountCode,
            mapping.retailkuAccountName,
            mapping.localAccountId,
          ]
        );
      }
    },
    invalidateKey: retailkuAccountMappingQueryKey,
    successMessage: "Mapping akun Retailku berhasil disimpan",
    errorMessage: "Gagal menyimpan mapping akun Retailku",
  });
}
