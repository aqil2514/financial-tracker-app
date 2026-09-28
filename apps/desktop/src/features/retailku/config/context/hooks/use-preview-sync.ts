"use client";

import { useMutation } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { assertRetailkuConfigured } from "@/shared/retailku";
import { computeCashflowSync } from "../../../shared/sync";
import type { PreviewSyncResult, UsePreviewSyncInput, UsePreviewSyncOutput } from "../interfaces";

export function usePreviewSync(): UsePreviewSyncOutput {
  return useMutation<PreviewSyncResult, Error, UsePreviewSyncInput>({
    mutationFn: async (input) => {
      const config = assertRetailkuConfigured(input.retailkuSettings!);
      const db = await getDb();
      const dateTo = input.syncRangeValue.to ?? input.syncRangeValue.from;

      const cashflow = await computeCashflowSync(db, {
        mcpConfig: config,
        dateFrom: input.syncRangeValue.from,
        dateTo,
        timezone: "Asia/Jakarta",
        mode: input.mode,
      });

      return { cashflow };
    },
  });
}
