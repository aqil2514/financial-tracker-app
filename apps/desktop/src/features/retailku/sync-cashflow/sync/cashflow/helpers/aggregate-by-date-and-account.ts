import type { getCashflowDetail } from "@/shared/retailku";
import type { AggregatedTotal } from "../types";

export function aggregateByDateAndAccount(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, AggregatedTotal>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const key = `${date}:${row.accountId}`;
    const existing = totals.get(key);
    const net = row.debit - row.credit;
    totals.set(key, {
      date,
      retailkuAccountId: row.accountId,
      accountName: row.accountName,
      net: (existing?.net ?? 0) + net,
      note: `Ringkasan Kas Harian Retailku — ${row.accountName}`,
      sourceRef: key,
    });
  }
  return [...totals.values()];
}
