import type { getCashflowDetail } from "@/shared/retailku";
import type { AggregatedTotal } from "../types";

export function aggregateByDateAccountAndSourceType(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, AggregatedTotal & { sourceType: string }>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const sourceType = row.sourceType ?? "LAINNYA";
    const key = `${date}:${row.accountId}:${sourceType}`;
    const existing = totals.get(key);
    const net = row.debit - row.credit;
    totals.set(key, {
      date,
      retailkuAccountId: row.accountId,
      accountName: row.accountName,
      sourceType,
      net: (existing?.net ?? 0) + net,
      note: `Kas Harian Retailku — ${row.accountName} — ${sourceType}`,
      sourceRef: key,
    });
  }
  return [...totals.values()];
}
