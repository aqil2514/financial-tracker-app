"use client";

import { useMutation } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { assertRetailkuConfigured, type RetailkuSettings } from "@/shared/retailku";
import { RetailkuCashflowSyncMode } from "../interfaces";
import { computeCashflowSync } from "@/features/retailku/shared/sync";

export type MappingKeyCandidate = {
  key: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  alreadyMapped: boolean;
};

export type LoadMappingKeysInput = {
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  dateFrom: string;
  dateTo: string;
};

export function useLoadMappingKeys() {
  return useMutation<MappingKeyCandidate[], Error, LoadMappingKeysInput>({
    mutationFn: async (input) => {
      const config = assertRetailkuConfigured(input.retailkuSettings!);
      const db = await getDb();

      // arApExistingMode tidak relevan di sini — halaman Mapping cuma
      // butuh plan.rows (cashflow biasa), bukan plan.arAp.
      const plan = await computeCashflowSync(db, {
        mcpConfig: config,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        timezone: "Asia/Jakarta",
        mode: input.mode,
        arApExistingMode: "skip",
      });

      const byKey = new Map<string, MappingKeyCandidate>();
      for (const row of plan.rows) {
        if (byKey.has(row.key)) continue;
        byKey.set(row.key, {
          key: row.key,
          retailkuAccountId: row.retailkuAccountId,
          retailkuAccountCode: row.retailkuAccountCode,
          accountName: row.accountName,
          alreadyMapped: row.skipReason !== "unmapped-account",
        });
      }
      return [...byKey.values()];
    },
  });
}
