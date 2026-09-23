"use client";

import { useMutation } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { assertRetailkuConfigured, type RetailkuSettings } from "@/shared/retailku";
import { computeCashflowSync, type CashflowSyncPlan, type RetailkuCashflowSyncMode } from "../../sync";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export type PreviewSyncInput = {
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  syncFromValue: string;
  arApCashAccountId: number | null;
  receivableDebtAccountId: number | null;
  payableDebtAccountId: number | null;
};

export type PreviewSyncResult = {
  cashflow: CashflowSyncPlan;
};

/**
 * Preview "APA yang akan disinkronkan" TANPA menulis apa pun ke
 * database — memanggil `computeCashflowSync` (fungsi murni baca-saja,
 * dipakai ULANG oleh `syncCashflow`) alih-alih `syncAll` yang benar-benar
 * insert. `computeCashflowSync` SEKARANG SUDAH mencakup `arApRows` di
 * dalam `CashflowSyncPlan`-nya (lihat
 * docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md) — TIDAK perlu
 * lagi `computeArApSync` terpisah (`sync-ar-ap.ts`, DIHAPUS).
 *
 * `useMutation` polos (BUKAN `useDbMutation`) karena preview tidak
 * menyimpan apa pun — tidak perlu toast sukses "tersimpan" atau
 * invalidate query, cuma trigger manual saat tombol "Lihat Preview"
 * diklik (bukan `useQuery` otomatis, supaya tidak memanggil MCP tiap
 * render tab Konfigurasi).
 */
export function usePreviewSync() {
  return useMutation<PreviewSyncResult, Error, PreviewSyncInput>({
    mutationFn: async (input) => {
      const config = assertRetailkuConfigured(input.retailkuSettings!);
      const db = await getDb();
      const dateTo = todayIso();

      const cashflow = await computeCashflowSync(db, {
        mcpConfig: config,
        dateFrom: input.syncFromValue,
        dateTo,
        timezone: "Asia/Jakarta",
        mode: input.mode,
        receivableDebtAccountId: input.receivableDebtAccountId,
        payableDebtAccountId: input.payableDebtAccountId,
        arApCashAccountId: input.arApCashAccountId,
      });

      return { cashflow };
    },
  });
}
