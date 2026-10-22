import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "../call-tool-as-json";
import type { CashflowDateRangeArgs } from "./shared";

export type RetailkuCashflowSummary = {
  data: { date: string; inflow: number; outflow: number; net: number }[];
  totals: { inflow: number; outflow: number; net: number };
};

/** Panggil tool `get_cashflow_summary` — ringkasan kas murni per hari
 * (bersumber dari jurnal akun kas/bank terposting), lihat
 * docs/todos/plan/retailku-cashflow-sync.md untuk alasan tool ini
 * dipilih sebagai sumber sync "mode ringkas". */
export async function getCashflowSummary(
  client: Client,
  args: CashflowDateRangeArgs
): Promise<RetailkuCashflowSummary> {
  return callToolAsJson<RetailkuCashflowSummary>(client, "get_cashflow_summary", args);
}
