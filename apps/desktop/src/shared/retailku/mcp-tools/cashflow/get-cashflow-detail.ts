import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "../call-tool-as-json";
import type { CashflowDateRangeArgs } from "./shared";

export type RetailkuCashflowDetailRow = {
  date: string;
  description: string | null;
  sourceType: string | null;
  sourceNumber: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

export type RetailkuCashflowDetail = {
  data: RetailkuCashflowDetailRow[];
  meta: { pagination: { page: number; limit: number; total: number; totalPages: number } };
};

/** Panggil tool `get_cashflow_detail` (baru dibangun & didaftarkan di
 * sisi Retailku, lihat retailku-cashflow-sync.md) — detail pergerakan
 * kas per transaksi individual, dengan pagination. */
export async function getCashflowDetail(
  client: Client,
  args: CashflowDateRangeArgs & { page?: number; limit?: number }
): Promise<RetailkuCashflowDetail> {
  return callToolAsJson<RetailkuCashflowDetail>(client, "get_cashflow_detail", args);
}
