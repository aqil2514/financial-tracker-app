import type { getCashflowDetail } from "@/shared/retailku";
import type { AggregatedTotal } from "../types";

export function aggregateByDateAccountAndSourceType(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, Omit<AggregatedTotal, "key"> & { sourceType: string }>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const sourceType = row.sourceType ?? "LAINNYA";
    const sourceRef = `${date}:${row.accountId}:${sourceType}`;
    const existing = totals.get(sourceRef);
    const net = row.debit - row.credit;
    totals.set(sourceRef, {
      date,
      retailkuAccountId: row.accountId,
      retailkuAccountCode: row.accountCode,
      accountName: row.accountName,
      sourceType,
      net: (existing?.net ?? 0) + net,
      note: `Kas Harian Retailku — ${row.accountName} — ${sourceType}`,
      sourceRef,
    });
  }
  // Arah WAJIB jadi bagian key walau sudah ada sourceType — dibuktikan
  // lewat data nyata (SL-260915-05) bahwa akun+sourceType YANG SAMA
  // bisa berlawanan arah (mis. "Seabank + SALE" kredit = payout PPOB,
  // TAPI "Seabank + SALE" debit = pendapatan yang kebetulan dibayar via
  // Seabank) — lihat docs/todos/plan/retailku-sync-field-mapping.md.
  return [...totals.values()].map((total) => ({
    ...total,
    key: `detail:${total.retailkuAccountId}:${total.sourceType}:${total.net >= 0 ? "inflow" : "outflow"}`,
  }));
}
