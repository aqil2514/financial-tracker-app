import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "../call-tool-as-json";
import type { CashflowDateRangeArgs } from "./shared";

export type RetailkuCashflowAllocation = {
  sourceType: string;
  breakdown: { accountName: string; net: number }[];
}[];

/** Panggil tool `get_cashflow_allocation` — breakdown per sourceType,
 * TAPI breakdown-nya sengaja MENGECUALIKAN akun kas itu sendiri (lihat
 * "Temuan besar" di retailku-cashflow-sync.md) — jadi ini bukan sumber
 * data buat sync, cuma ditampilkan sebagai info tambahan. */
export async function getCashflowAllocation(
  client: Client,
  args: CashflowDateRangeArgs
): Promise<RetailkuCashflowAllocation> {
  return callToolAsJson<RetailkuCashflowAllocation>(client, "get_cashflow_allocation", args);
}
