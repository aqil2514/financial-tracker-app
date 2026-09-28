"use client";

import { toast } from "sonner";

import { assertRetailkuConfigured } from "@/shared/retailku";
import { useSyncRetailkuAll } from "../../../shared/sync";
import type { UseSyncNowInput, UseSyncNowOutput } from "../interfaces";

export function useSyncNow(input: UseSyncNowInput): UseSyncNowOutput {
  const syncAll = useSyncRetailkuAll();

  const canSync = input.hasCredentials && input.syncRangeValue.from !== "";

  function handleSyncNow() {
    if (!canSync) return;
    const config = assertRetailkuConfigured(input.retailkuSettings!);
    const dateTo = input.syncRangeValue.to ?? input.syncRangeValue.from;

    syncAll.mutate(
      {
        mcpConfig: config,
        dateFrom: input.syncRangeValue.from,
        dateTo,
        timezone: "Asia/Jakarta",
        mode: input.mode,
        arApExistingMode: input.arApExistingMode,
      },
      {
        onSuccess: (result) => {
          if (result.cashflowUnmappedKeys.length > 0) {
            toast.warning(
              `${result.cashflowUnmappedKeys.length} jenis transaksi Retailku belum dipetakan — baris kasnya di-skip. Lengkapi di tab Mapping.`
            );
          }
          if (result.cashflowDeactivatedPaymentMethodAccountIds.length > 0) {
            toast.warning(
              `${result.cashflowDeactivatedPaymentMethodAccountIds.length} akun kas Retailku sudah dinonaktifkan sebagai payment method — baris kasnya di-skip. Perbarui mapping di tab Mapping.`
            );
          }
          if (result.arApUnmappedDebtKeys.length > 0) {
            toast.warning(
              `${result.arApUnmappedDebtKeys.length} akun piutang/utang Retailku belum dipetakan — barisnya di-skip. Lengkapi di tab Mapping.`
            );
          }
          if (result.arApUpdatedCount > 0) {
            toast.info(`${result.arApUpdatedCount} piutang/utang yang sudah tersinkron diperbarui.`);
          }
          if (result.arApPaymentInsertedCount > 0) {
            toast.info(`${result.arApPaymentInsertedCount} pelunasan piutang tercatat.`);
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
