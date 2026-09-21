"use client";

import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { syncAll, type SyncAllInput, type SyncAllResult } from "./sync-all";
import { retailkuCashflowSyncSettingsQueryKey } from "./use-retailku-cashflow-sync-settings";

/**
 * Mutation untuk tombol "Sync Sekarang" di tab Konfigurasi — lihat
 * docs/todos/plan/retailku-cashflow-sync.md. Membungkus `syncAll()`
 * (all-or-nothing) dan invalidate query transaksi/settings terkait
 * setelah sukses.
 */
export function useSyncRetailkuAll() {
  return useDbMutation<SyncAllInput, SyncAllResult>({
    mutationFn: syncAll,
    invalidateKey: [...QUERY_DEPENDENCIES.transactions, retailkuCashflowSyncSettingsQueryKey],
    successMessage: "Sinkronisasi Retailku berhasil",
    errorMessage: "Sinkronisasi Retailku gagal, tidak ada perubahan disimpan",
  });
}
