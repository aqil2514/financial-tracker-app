"use client";

import { toast } from "sonner";

import { assertRetailkuConfigured, type RetailkuSettings } from "@/shared/retailku";
import { useSyncRetailkuAll, type RetailkuCashflowSyncMode } from "../../sync";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export type SyncNowInput = {
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
 *
 * SENGAJA TIDAK mewajibkan mapping sudah ada (`hasMappings`, dihapus
 * dari syarat) — sync per baris SUDAH skip sendiri key yang belum
 * dipetakan (`skipReason: "unmapped-account"`, toast peringatan di
 * bawah), jadi mewajibkannya sebagai gate KESELURUHAN tombol cuma
 * memblokir sync yang justru valid buat baris lain yang SUDAH
 * dipetakan. User diarahkan melengkapi mapping di tab Mapping, bukan
 * diblokir total di sini.
 */
export function useSyncNow(input: SyncNowInput) {
  const syncAll = useSyncRetailkuAll();

  const canSync =
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
