import type { getCashflowDetail } from "@/shared/retailku";
import { classifyCashflowRow } from "../classify-cashflow-row";
import type { AggregatedTotal } from "../../types";

export function aggregateByDateAndAccount(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, Omit<AggregatedTotal, "key">>();
  for (const row of rows) {
    // Baris NON-generik (AR/AP, provider payout) diproses jalur
    // TERPISAH — lihat classify-cashflow-row.ts.
    if (classifyCashflowRow(row) !== "generic") continue;
    const date = row.date.slice(0, 10);
    const sourceRef = `${date}:${row.accountId}`;
    const existing = totals.get(sourceRef);
    const net = row.debit - row.credit;
    totals.set(sourceRef, {
      date,
      retailkuAccountId: row.accountId,
      retailkuAccountCode: row.accountCode,
      accountName: row.accountName,
      net: (existing?.net ?? 0) + net,
      note: `Ringkasan Kas Harian Retailku — ${row.accountName}`,
      sourceRef,
    });
  }
  return [...totals.values()].map((total) => ({
    ...total,
    key: `summary:${total.net >= 0 ? "inflow" : "outflow"}:${total.retailkuAccountId}`,
  }));
}
