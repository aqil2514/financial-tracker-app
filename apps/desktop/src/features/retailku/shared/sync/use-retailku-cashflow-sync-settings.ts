"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

const SYNC_MODE_KEY = "retailku_cashflow_sync_mode";

export const retailkuCashflowSyncSettingsQueryKey = ["settings", "retailku-cashflow-sync"];

export type RetailkuCashflowSyncMode = "summary" | "detail";

export type RetailkuCashflowSyncSettings = {
  syncMode: RetailkuCashflowSyncMode;
};

export function useRetailkuCashflowSyncSettings() {
  return useQuery({
    queryKey: retailkuCashflowSyncSettingsQueryKey,
    queryFn: async (): Promise<RetailkuCashflowSyncSettings> => {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string | null }[]>(
        "SELECT key, value FROM settings WHERE key = $1",
        [SYNC_MODE_KEY]
      );
      const value = rows[0]?.value ?? null;

      return {
        syncMode: value === "detail" ? "detail" : "summary",
      };
    },
  });
}

export function useSetRetailkuCashflowSyncSettings() {
  return useDbMutation({
    mutationFn: async (settings: Partial<RetailkuCashflowSyncSettings>) => {
      if (!("syncMode" in settings)) return;
      const db = await getDb();
      await db.execute(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [SYNC_MODE_KEY, settings.syncMode ?? "summary"]
      );
    },
    invalidateKey: retailkuCashflowSyncSettingsQueryKey,
    successMessage: "Pengaturan sync berhasil disimpan",
    errorMessage: "Gagal menyimpan pengaturan sync",
  });
}
