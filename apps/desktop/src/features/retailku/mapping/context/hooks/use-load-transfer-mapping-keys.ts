"use client";

import { useMutation } from "@tanstack/react-query";

import { assertRetailkuConfigured, connectRetailkuMcp, type RetailkuSettings } from "@/shared/retailku";
import { extractTransferRows } from "@/features/retailku/shared/sync/cashflow/helpers/extract-transfer-rows";
import { fetchAllTransferListItems } from "@/features/retailku/shared/sync/cashflow/helpers/fetch-all-transfer-list-items";

export type TransferMappingKeyCandidate = {
  key: string;
  fromAccountName: string;
  toAccountName: string;
  /** Berapa transaksi transfer dgn PASANGAN akun ini muncul di rentang
   * tanggal yg dimuat — MURNI informasi tampilan (bukan bagian `key`,
   * lihat `extract-transfer-rows.ts`), supaya user tahu key ini
   * mewakili banyak transaksi, bukan satu. */
  transactionCount: number;
};

export type LoadTransferMappingKeysInput = {
  retailkuSettings: RetailkuSettings | undefined;
  dateFrom: string;
  dateTo: string;
};

/** Cari SEMUA `key` transfer (`transfer:<fromAccountId>:<toAccountId>`,
 * per PASANGAN akun — lihat `extract-transfer-rows.ts`) yang muncul di
 * rentang tanggal tertentu — SEJAJAR `useLoadMappingKeys` (generic),
 * TAPI TIDAK lewat `computeCashflowSync`/`aggregate-by-*.ts` sama
 * sekali (lihat `extract-transfer-rows.ts`: `fromAccountId`/
 * `toAccountId` sudah eksplisit dari sumbernya sendiri, tidak perlu
 * agregasi net kas). Sumber: `get_fund_transfer_list` LANGSUNG,
 * connect+fetch+close sendiri (pola sama `use-retailku-cashflow-detail.ts`),
 * BUKAN diperluas dari `computeCashflowSync` — menjaga jalur transfer
 * tetap terpisah dari mesin agregasi generik, lihat diskusi handover
 * "gambaran kode" 2026-09-28. */
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
