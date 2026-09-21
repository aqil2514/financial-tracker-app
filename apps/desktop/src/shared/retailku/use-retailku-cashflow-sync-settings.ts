"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

const SYNC_FROM_KEY = "retailku_cashflow_sync_from";
const AUTO_SYNC_ENABLED_KEY = "retailku_cashflow_auto_sync_enabled";
const LAST_AUTO_SYNC_DATE_KEY = "retailku_cashflow_last_auto_sync_date";
const SYNC_MODE_KEY = "retailku_cashflow_sync_mode";

export const retailkuCashflowSyncSettingsQueryKey = ["settings", "retailku-cashflow-sync"];

export type RetailkuCashflowSyncMode = "summary" | "detail";

export type RetailkuCashflowSyncSettings = {
  /** Tanggal ISO (`"2026-09-20"`) — titik awal rentang yang akan diproses
   * sync berikutnya, lihat "Pertanyaan terbuka #1" di
   * retailku-cashflow-sync.md. `null` kalau belum pernah di-set (mis.
   * mapping akun belum pernah disimpan). BISA DIEDIT MANUAL oleh user di
   * tab Konfigurasi, TIDAK cuma maju otomatis. */
  syncFrom: string | null;
  /** Toggle sync otomatis saat app dibuka — lihat "Pertanyaan terbuka #2". */
  autoSyncEnabled: boolean;
  /** Tanggal ISO terakhir kali sync OTOMATIS (bukan manual) berhasil
   * dijalankan — pembatas supaya otomatis maksimal 1x per hari. */
  lastAutoSyncDate: string | null;
  /** Mode cashflow yang dipakai sync berikutnya — lihat keputusan #6. */
  syncMode: RetailkuCashflowSyncMode;
};

/**
 * Pengaturan sync cashflow+AR/AP Retailku, disimpan di tabel `settings`
 * key-value yang sudah ada — pola KONSISTEN dengan
 * `use-retailku-settings.ts` (mcpUrl/apiKey), BUKAN tabel/migrasi baru.
 * Lihat docs/todos/plan/retailku-cashflow-sync.md bagian "Pertanyaan
 * terbuka #1/#2" untuk alasan lengkap tiap field.
 */
export function useRetailkuCashflowSyncSettings() {
  return useQuery({
    queryKey: retailkuCashflowSyncSettingsQueryKey,
    queryFn: async (): Promise<RetailkuCashflowSyncSettings> => {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string | null }[]>(
        "SELECT key, value FROM settings WHERE key IN ($1, $2, $3, $4)",
        [SYNC_FROM_KEY, AUTO_SYNC_ENABLED_KEY, LAST_AUTO_SYNC_DATE_KEY, SYNC_MODE_KEY]
      );
      const find = (key: string) => rows.find((row) => row.key === key)?.value ?? null;

      return {
        syncFrom: find(SYNC_FROM_KEY),
        // Default MENYALA — toggle ini untuk mematikan, bukan menyalakan,
        // sesuai keputusan #2 ("default menyala").
        autoSyncEnabled: find(AUTO_SYNC_ENABLED_KEY) !== "0",
        lastAutoSyncDate: find(LAST_AUTO_SYNC_DATE_KEY),
        syncMode: find(SYNC_MODE_KEY) === "detail" ? "detail" : "summary",
      };
    },
  });
}

export function useSetRetailkuCashflowSyncSettings() {
  return useDbMutation({
    mutationFn: async (settings: Partial<RetailkuCashflowSyncSettings>) => {
      const db = await getDb();
      const entries: [string, string | null][] = [];
      if ("syncFrom" in settings) entries.push([SYNC_FROM_KEY, settings.syncFrom ?? null]);
      if ("autoSyncEnabled" in settings) {
        entries.push([AUTO_SYNC_ENABLED_KEY, settings.autoSyncEnabled ? "1" : "0"]);
      }
      if ("lastAutoSyncDate" in settings) {
        entries.push([LAST_AUTO_SYNC_DATE_KEY, settings.lastAutoSyncDate ?? null]);
      }
      if ("syncMode" in settings) entries.push([SYNC_MODE_KEY, settings.syncMode ?? "summary"]);

      for (const [key, value] of entries) {
        await db.execute(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [key, value]
        );
      }
    },
    invalidateKey: retailkuCashflowSyncSettingsQueryKey,
    successMessage: "Pengaturan sync berhasil disimpan",
    errorMessage: "Gagal menyimpan pengaturan sync",
  });
}
