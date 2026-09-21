"use client";

import { useMutation } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { assertRetailkuConfigured, type RetailkuSettings } from "@/shared/retailku";
import {
  computeCashflowSync,
  computeArApSync,
  type CashflowSyncPlan,
  type ArApSyncPlan,
  type RetailkuCashflowSyncMode,
} from "../../sync";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export type PreviewSyncInput = {
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  syncFromValue: string;
};

export type PreviewSyncResult = {
  cashflow: CashflowSyncPlan;
  arAp: ArApSyncPlan;
};

/**
 * Preview "APA yang akan disinkronkan" TANPA menulis apa pun ke
 * database — memanggil `computeCashflowSync`/`computeArApSync` (fungsi
 * murni baca-saja yang di-EXTRACT dari `syncCashflow`/`syncArAp`,
 * dipakai ULANG oleh keduanya) alih-alih `syncAll` yang benar-benar
 * insert. `useMutation` polos (BUKAN `useDbMutation`) karena preview
 * tidak menyimpan apa pun — tidak perlu toast sukses "tersimpan" atau
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

      const [cashflow, arAp] = await Promise.all([
        computeCashflowSync(db, {
          mcpConfig: config,
          dateFrom: input.syncFromValue,
          dateTo,
          timezone: "Asia/Jakarta",
          mode: input.mode,
        }),
        computeArApSync(db, config),
      ]);

      return { cashflow, arAp };
    },
  });
}
