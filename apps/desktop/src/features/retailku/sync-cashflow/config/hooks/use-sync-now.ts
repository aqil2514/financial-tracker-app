"use client";

import { toast } from "sonner";

import { assertRetailkuConfigured, type RetailkuSettings } from "@/shared/retailku";
import { useSyncRetailkuAll, type RetailkuCashflowSyncMode } from "../../sync";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export type SyncNowInput = {
  hasMappings: boolean;
  hasCredentials: boolean;
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  arApCashAccountId: string;
  receivableDebtAccountId: string;
  payableDebtAccountId: string;
  syncFromValue: string;
  onSynced: (today: string) => void;
};

/**
 * Aksi "Sync Sekarang" — orkestrasi: validasi semua prasyarat
 * (`canSync`), rakit payload dari field-field konfigurasi (mode, 3
 * akun, titik awal), panggil `syncAll`, lalu efek samping (maju
 * `syncFrom` ke hari ini via `onSynced`, toast peringatan akun yang
 * belum dipetakan).
 */
export function useSyncNow(input: SyncNowInput) {
  const syncAll = useSyncRetailkuAll();

  const canSync =
    input.hasMappings &&
    input.hasCredentials &&
    input.arApCashAccountId !== "" &&
    input.receivableDebtAccountId !== "" &&
    input.payableDebtAccountId !== "" &&
    input.syncFromValue !== "";

  function handleSyncNow() {
    if (!canSync) return;
    const config = assertRetailkuConfigured(input.retailkuSettings!);

    syncAll.mutate(
      {
        mcpConfig: config,
        arApCashAccountId: Number(input.arApCashAccountId),
        receivableDebtAccountId: Number(input.receivableDebtAccountId),
        payableDebtAccountId: Number(input.payableDebtAccountId),
        dateFrom: input.syncFromValue,
        dateTo: todayIso(),
        timezone: "Asia/Jakarta",
        mode: input.mode,
      },
      {
        onSuccess: (result) => {
          input.onSynced(todayIso());
          if (result.cashflowUnmappedAccountIds.length > 0) {
            toast.warning(
              `${result.cashflowUnmappedAccountIds.length} akun kas Retailku belum dipetakan — baris kasnya di-skip. Lengkapi di Mapping Akun.`
            );
          }
        },
      }
    );
  }

  return {
    canSync,
    handleSyncNow,
    isSyncing: syncAll.isPending,
  };
}
