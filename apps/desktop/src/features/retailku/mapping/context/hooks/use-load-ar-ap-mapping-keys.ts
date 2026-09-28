"use client";

import { useMutation } from "@tanstack/react-query";

import { assertRetailkuConfigured, connectRetailkuMcp, type RetailkuSettings } from "@/shared/retailku";
import { fetchAllCashflowDetailRows } from "@/features/retailku/shared/sync/cashflow/helpers/load-sync-inputs/fetch-all-cashflow-detail-rows";
import { buildArApMappingKey, extractArApRows } from "@/features/retailku/shared/sync/cashflow/helpers/extract-ar-ap-rows";

export type ArApMappingKeyCandidate = {
  key: string;
  accountName: string;
  direction: "receivable" | "payable";
  kind: "trade" | "non-trade" | null;
  transactionCount: number;
  partyNames: string[];
};

export type LoadArApMappingKeysInput = {
  retailkuSettings: RetailkuSettings | undefined;
  dateFrom: string;
  dateTo: string;
};

export function useLoadArApMappingKeys() {
  return useMutation<ArApMappingKeyCandidate[], Error, LoadArApMappingKeysInput>({
    mutationFn: async (input) => {
      const config = assertRetailkuConfigured(input.retailkuSettings!);
      const client = await connectRetailkuMcp(config);
      try {
        const rows = await fetchAllCashflowDetailRows(client, {
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          timezone: "Asia/Jakarta",
        });
        const arApRows = extractArApRows(rows);

        const byKey = new Map<string, ArApMappingKeyCandidate>();
        for (const row of arApRows) {
          const key = buildArApMappingKey(row.accountId, row.direction);
          const existing = byKey.get(key);
          if (existing) {
            existing.transactionCount += 1;
            if (row.partyName && !existing.partyNames.includes(row.partyName)) {
              existing.partyNames.push(row.partyName);
            }
            continue;
          }
          byKey.set(key, {
            key,
            accountName: row.accountName,
            direction: row.direction,
            kind: row.kind,
            transactionCount: 1,
            partyNames: row.partyName ? [row.partyName] : [],
          });
        }
        return [...byKey.values()];
      } finally {
        await client.close();
      }
    },
  });
}
