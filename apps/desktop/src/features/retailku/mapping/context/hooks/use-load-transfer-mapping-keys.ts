"use client";

import { useMutation } from "@tanstack/react-query";

import { assertRetailkuConfigured, connectRetailkuMcp, type RetailkuSettings } from "@/shared/retailku";
import { extractTransferRows } from "@/features/retailku/shared/sync/cashflow/helpers/extract-transfer-rows";
import { fetchAllTransferListItems } from "@/features/retailku/shared/sync/cashflow/helpers/fetch-all-transfer-list-items";

export type TransferMappingKeyCandidate = {
  key: string;
  fromAccountName: string;
  toAccountName: string;
  transactionCount: number;
};

export type LoadTransferMappingKeysInput = {
  retailkuSettings: RetailkuSettings | undefined;
  dateFrom: string;
  dateTo: string;
};

export function useLoadTransferMappingKeys() {
  return useMutation<TransferMappingKeyCandidate[], Error, LoadTransferMappingKeysInput>({
    mutationFn: async (input) => {
      const config = assertRetailkuConfigured(input.retailkuSettings!);
      const client = await connectRetailkuMcp(config);
      try {
        const items = await fetchAllTransferListItems(client, {
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          timezone: "Asia/Jakarta",
        });
        const transferRows = extractTransferRows(items);

        const byKey = new Map<string, TransferMappingKeyCandidate>();
        for (const row of transferRows) {
          const existing = byKey.get(row.key);
          if (existing) {
            existing.transactionCount += 1;
            continue;
          }
          byKey.set(row.key, {
            key: row.key,
            fromAccountName: row.fromAccountName,
            toAccountName: row.toAccountName,
            transactionCount: 1,
          });
        }
        return [...byKey.values()];
      } finally {
        await client.close();
      }
    },
  });
}
