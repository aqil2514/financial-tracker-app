"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

const SYNC_MODE_KEY = "retailku_cashflow_sync_mode";
const AR_AP_CASH_ACCOUNT_ID_KEY = "retailku_ar_ap_cash_account_id";
const RECEIVABLE_DEBT_ACCOUNT_ID_KEY = "retailku_receivable_debt_account_id";
const PAYABLE_DEBT_ACCOUNT_ID_KEY = "retailku_payable_debt_account_id";

export const retailkuCashflowSyncSettingsQueryKey = ["settings", "retailku-cashflow-sync"];

export type RetailkuCashflowSyncMode = "summary" | "detail";

export type RetailkuCashflowSyncSettings = {
  /** Mode cashflow yang dipakai sync berikutnya — lihat keputusan #6. */
  syncMode: RetailkuCashflowSyncMode;
  /** Tiga field akun di tab Konfigurasi ("Akun Kas untuk Utang Piutang",
   * "Akun untuk Piutang", "Akun untuk Utang") — SEMPAT cuma `useState`
   * lokal (hilang tiap pindah tab/tutup app, ditemukan sebagai bug live:
   * "sudah berhasil disimpan tapi kembali ke halaman ini, tidak ada yang
   * benar-benar tersimpan"), sekarang disimpan di `settings` sama seperti
   * field lain di tab ini. `null` kalau belum pernah dipilih. */
  arApCashAccountId: number | null;
  receivableDebtAccountId: number | null;
  payableDebtAccountId: number | null;
};

/**
 * Pengaturan sync cashflow+AR/AP Retailku, disimpan di tabel `settings`
 * key-value yang sudah ada — pola KONSISTEN dengan
 * `use-retailku-settings.ts` (mcpUrl/apiKey), BUKAN tabel/migrasi baru.
 *
 * Sync satu-satunya adalah MANUAL (tombol "Sync Sekarang") — TIDAK ada
 * lagi titik awal/akhir persisten atau auto-sync (dihapus total, lihat
 * handover 2026-09-26): periode yang diproses murni draft sekali pakai
 * di UI (`sync-from-section.tsx`), tidak disimpan ke `settings` di sini.
 */
export function useRetailkuCashflowSyncSettings() {
  return useQuery({
    queryKey: retailkuCashflowSyncSettingsQueryKey,
    queryFn: async (): Promise<RetailkuCashflowSyncSettings> => {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string | null }[]>(
        "SELECT key, value FROM settings WHERE key IN ($1, $2, $3, $4)",
        [SYNC_MODE_KEY, AR_AP_CASH_ACCOUNT_ID_KEY, RECEIVABLE_DEBT_ACCOUNT_ID_KEY, PAYABLE_DEBT_ACCOUNT_ID_KEY]
      );
      const find = (key: string) => rows.find((row) => row.key === key)?.value ?? null;
      const findNumber = (key: string) => {
        const value = find(key);
        return value == null ? null : Number(value);
      };

      return {
        syncMode: find(SYNC_MODE_KEY) === "detail" ? "detail" : "summary",
        arApCashAccountId: findNumber(AR_AP_CASH_ACCOUNT_ID_KEY),
        receivableDebtAccountId: findNumber(RECEIVABLE_DEBT_ACCOUNT_ID_KEY),
        payableDebtAccountId: findNumber(PAYABLE_DEBT_ACCOUNT_ID_KEY),
      };
    },
  });
}

export function useSetRetailkuCashflowSyncSettings() {
  return useDbMutation({
    mutationFn: async (settings: Partial<RetailkuCashflowSyncSettings>) => {
      const db = await getDb();
      const entries: [string, string | null][] = [];
      if ("syncMode" in settings) entries.push([SYNC_MODE_KEY, settings.syncMode ?? "summary"]);
      if ("arApCashAccountId" in settings) {
        entries.push([AR_AP_CASH_ACCOUNT_ID_KEY, settings.arApCashAccountId?.toString() ?? null]);
      }
      if ("receivableDebtAccountId" in settings) {
        entries.push([
          RECEIVABLE_DEBT_ACCOUNT_ID_KEY,
          settings.receivableDebtAccountId?.toString() ?? null,
        ]);
      }
      if ("payableDebtAccountId" in settings) {
        entries.push([PAYABLE_DEBT_ACCOUNT_ID_KEY, settings.payableDebtAccountId?.toString() ?? null]);
      }

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
