"use client";

import { useMutation } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { assertRetailkuConfigured } from "@/shared/retailku";
import { computeCashflowSync } from "../../../../shared/sync";
import type { PreviewSyncResult, UsePreviewSyncInput, UsePreviewSyncOutput } from "../interfaces";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Preview "APA yang akan disinkronkan" TANPA menulis apa pun ke
 * database — memanggil `computeCashflowSync` (fungsi murni baca-saja,
 * dipakai ULANG oleh `syncCashflow`) alih-alih `syncAll` yang benar-benar
 * insert.
 *
 * `useMutation` polos (BUKAN `useDbMutation`) karena preview tidak
 * menyimpan apa pun — tidak perlu toast sukses "tersimpan" atau
 * invalidate query, cuma trigger manual saat tombol "Lihat Preview"
 * diklik (bukan `useQuery` otomatis, supaya tidak memanggil MCP tiap
 * render tab Konfigurasi).
 */
export function usePreviewSync(): UsePreviewSyncOutput {
  return useMutation<PreviewSyncResult, Error, UsePreviewSyncInput>({
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
