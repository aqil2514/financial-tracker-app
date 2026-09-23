"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";

export const retailkuAccountMappingQueryKey = ["retailku", "account-mapping"];

export type RetailkuAccountMapping = {
  retailkuAccountId: string;
  retailkuAccountCode: string;
  retailkuAccountName: string;
  localAccountId: number;
};

type RetailkuSyncFieldMappingRow = {
  retailku_account_id: string;
  retailku_account_code: string;
  retailku_account_name: string;
  local_account_id: number;
};

/**
 * Ringkasan "akun Retailku mana yang SUDAH punya mapping" — dibaca dari
 * `retailku_sync_field_mapping` (menggantikan `retailku_account_mapping`,
 * lihat docs/todos/plan/retailku-sync-field-mapping.md), TAPI cuma
 * filter key `summary:inflow:*` sebagai representative SATU baris per
 * akun (migrasi 0020 SELALU membuat pasangan inflow+outflow bersamaan
 * untuk data lama, jadi inflow saja cukup untuk "akun ini pernah
 * di-mapping") — dipakai badge/deteksi orphan (`useRetailkuMappingIssues`,
 * `AppSidebar`) yang levelnya masih PER AKUN, bukan per key detail.
 *
 * SEMENTARA (2026-09-23): halaman UI penuh (`AccountMappingList`,
 * `use-account-mapping-draft.ts`) DINONAKTIFKAN sampai UI mapping baru
 * dibangun (lihat app/(app)/retailku/mapping/page.tsx) — hook ini
 * TETAP dipertahankan aktif karena dipakai badge sidebar & deteksi
 * orphan mapping yang jalan GLOBAL (bukan cuma di halaman mapping),
 * TIDAK boleh crash gara-gara tabel lama sudah di-drop.
 */
export function useRetailkuAccountMapping() {
  return useQuery({
    queryKey: retailkuAccountMappingQueryKey,
    queryFn: async (): Promise<RetailkuAccountMapping[]> => {
      const db = await getDb();
      const rows = await db.select<RetailkuSyncFieldMappingRow[]>(
        `SELECT retailku_account_id, retailku_account_code, retailku_account_name, local_account_id
         FROM retailku_sync_field_mapping
         WHERE key LIKE 'summary:inflow:%'`
      );
      return rows.map((row) => ({
        retailkuAccountId: row.retailku_account_id,
        retailkuAccountCode: row.retailku_account_code,
        retailkuAccountName: row.retailku_account_name,
        localAccountId: row.local_account_id,
      }));
    },
  });
}
