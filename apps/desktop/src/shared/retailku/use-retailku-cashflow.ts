"use client";

import { useQuery } from "@tanstack/react-query";

import { assertRetailkuConfigured, connectRetailkuMcp } from "./mcp-connection";
import {
  getArAp,
  getCashflowAllocation,
  getCashflowDetail,
  getCashflowSummary,
  type RetailkuArAp,
  type RetailkuCashflowAllocation,
  type RetailkuCashflowDetail,
  type RetailkuCashflowSummary,
} from "./mcp-tools";
import { useRetailkuSettings } from "./use-retailku-settings";

export type CashflowDateRange = {
  dateFrom: string;
  dateTo: string;
  timezone: string;
};

/**
 * Tiga hook untuk menampilkan data mentah cashflow Retailku
 * (tab "Ringkasan" di /retailku/cashflow — lihat
 * docs/todos/plan/retailku-cashflow-sync.md), sebelum logic sync
 * sungguhan dibangun. Masing-masing membuka+menutup koneksi MCP
 * sendiri (bukan koneksi persisten) — wajar untuk kebutuhan lihat
 * data yang dipicu manual, bukan sync berulang.
 */

export function useRetailkuCashflowSummary(range: CashflowDateRange) {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: ["retailku", "cashflow-summary", range],
    queryFn: async (): Promise<RetailkuCashflowSummary> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        return await getCashflowSummary(client, range);
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}

export function useRetailkuCashflowAllocation(range: CashflowDateRange) {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: ["retailku", "cashflow-allocation", range],
    queryFn: async (): Promise<RetailkuCashflowAllocation> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        return await getCashflowAllocation(client, range);
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}

export function useRetailkuCashflowDetail(
  range: CashflowDateRange,
  page: number,
  limit: number = 20
) {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: ["retailku", "cashflow-detail", range, page, limit],
    queryFn: async (): Promise<RetailkuCashflowDetail> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        return await getCashflowDetail(client, { ...range, page, limit });
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}

/** Snapshot piutang/utang outstanding SAAT INI (bukan rentang tanggal,
 * lihat `getArAp` di mcp-tools.ts) — dipakai tab "Utang
 * Piutang" di /retailku/cashflow. */
export function useRetailkuArAp() {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: ["retailku", "ar-ap"],
    queryFn: async (): Promise<RetailkuArAp> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        return await getArAp(client);
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}
