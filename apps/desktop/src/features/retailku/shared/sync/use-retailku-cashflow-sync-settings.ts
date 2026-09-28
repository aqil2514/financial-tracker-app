"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

const SYNC_MODE_KEY = "retailku_cashflow_sync_mode";
const AR_AP_EXISTING_MODE_KEY = "retailku_ar_ap_existing_mode";

export const retailkuCashflowSyncSettingsQueryKey = ["settings", "retailku-cashflow-sync"];

export type RetailkuCashflowSyncMode = "summary" | "detail";
export type RetailkuArApExistingMode = "skip" | "overwrite";

export type RetailkuCashflowSyncSettings = {
  syncMode: RetailkuCashflowSyncMode;
  arApExistingMode: RetailkuArApExistingMode;
};

export function useRetailkuCashflowSyncSettings() {
  return useQuery({
    queryKey: retailkuCashflowSyncSettingsQueryKey,
    queryFn: async (): Promise<RetailkuCashflowSyncSettings> => {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string | null }[]>(
        "SELECT key, value FROM settings WHERE key IN ($1, $2)",
        [SYNC_MODE_KEY, AR_AP_EXISTING_MODE_KEY]
      );
      const syncModeValue = rows.find((r) => r.key === SYNC_MODE_KEY)?.value ?? null;
      const arApExistingModeValue = rows.find((r) => r.key === AR_AP_EXISTING_MODE_KEY)?.value ?? null;

      return {
        syncMode: syncModeValue === "detail" ? "detail" : "summary",
        arApExistingMode: arApExistingModeValue === "overwrite" ? "overwrite" : "skip",
      };
    },
  });
}

const SETTINGS_KEY_BY_FIELD: Record<keyof RetailkuCashflowSyncSettings, string> = {
  syncMode: SYNC_MODE_KEY,
  arApExistingMode: AR_AP_EXISTING_MODE_KEY,
};

export function useSetRetailkuCashflowSyncSettings() {
  return useDbMutation({
    mutationFn: async (settings: Partial<RetailkuCashflowSyncSettings>) => {
      const db = await getDb();
      for (const field of Object.keys(settings) as (keyof RetailkuCashflowSyncSettings)[]) {
        const value = settings[field];
        if (value == null) continue;
        await db.execute(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [SETTINGS_KEY_BY_FIELD[field], value]
        );
      }
    },
    invalidateKey: retailkuCashflowSyncSettingsQueryKey,
    successMessage: "Pengaturan sync berhasil disimpan",
    errorMessage: "Gagal menyimpan pengaturan sync",
  });
}
