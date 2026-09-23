"use client";

import { useMutation } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { assertRetailkuConfigured, type RetailkuSettings } from "@/shared/retailku";
import { computeCashflowSync } from "../../sync";
import type { RetailkuCashflowSyncMode } from "../../sync";

export type MappingKeyCandidate = {
  key: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  /** `true` kalau key ini SUDAH ada baris `retailku_sync_field_mapping`
   * (dicek dari `skipReason !== "unmapped-account"` hasil
   * `computeCashflowSync`) — dipakai urutan tampilan (belum dipetakan
   * duluan), BUKAN sumber kebenaran akhir (itu tetap `useFieldMapping`,
   * di-gabung terpisah oleh `use-mapping-draft.ts`). */
  alreadyMapped: boolean;
};

export type LoadMappingKeysInput = {
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  dateFrom: string;
  dateTo: string;
};

/**
 * Cari SEMUA `key` (lihat `CashflowSyncPlanRow.key`) yang muncul di
 * rentang tanggal tertentu — key baru cuma "ada" setelah sync (atau
 * preview-nya) menjumpai kombinasi itu, jadi UI tab Mapping TIDAK bisa
 * cukup baca `retailku_sync_field_mapping` (isinya cuma yang SUDAH
 * di-mapping) — perlu jalan `computeCashflowSync` (baca-saja, SAMA
 * dipakai Preview Sync di tab Konfigurasi) untuk tahu key APA SAJA yang
 * relevan, lihat docs/todos/plan/retailku-sync-field-mapping.md.
 *
 * Dedupe per `key` (satu rentang tanggal bisa punya banyak baris
 * dengan `key` sama, mis. tiap hari) — cukup simpan SATU representative
 * (`accountName` dkk sama untuk key yang sama, jadi baris pertama yang
 * ditemukan cukup).
 */
export function useLoadMappingKeys() {
  return useMutation<MappingKeyCandidate[], Error, LoadMappingKeysInput>({
    mutationFn: async (input) => {
      const config = assertRetailkuConfigured(input.retailkuSettings!);
      const db = await getDb();

      const plan = await computeCashflowSync(db, {
        mcpConfig: config,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        timezone: "Asia/Jakarta",
        mode: input.mode,
      });

      const byKey = new Map<string, MappingKeyCandidate>();
      for (const row of plan.rows) {
        if (byKey.has(row.key)) continue;
        byKey.set(row.key, {
          key: row.key,
          retailkuAccountId: row.retailkuAccountId,
          retailkuAccountCode: row.retailkuAccountCode,
          accountName: row.accountName,
          alreadyMapped: row.skipReason !== "unmapped-account",
        });
      }
      return [...byKey.values()];
    },
  });
}
