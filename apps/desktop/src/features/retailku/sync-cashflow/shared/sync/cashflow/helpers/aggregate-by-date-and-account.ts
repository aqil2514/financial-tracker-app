import type { getCashflowDetail } from "@/shared/retailku";
import type { AggregatedTotal } from "../types";

export function aggregateByDateAndAccount(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, Omit<AggregatedTotal, "key">>();
  for (const row of rows) {
    // Baris piutang/utang (akun neraca, BUKAN kas/bank) diproses jalur
    // TERPISAH (lihat extract-ar-ap-rows.ts) — ikut campur ke net akun
    // biasa di sini akan salah (piutang baru bukan "uang masuk" akun
    // kas), lihat docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md.
    if (row.isReceivablePayableAccount) continue;
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
  // Arah (inflow/outflow) HANYA bisa ditentukan setelah net FINAL
  // dihitung (bukan per baris mentah) — satu akun bisa berganti arah
  // hari ke hari (dibuktikan lewat data nyata, lihat
  // docs/todos/plan/retailku-sync-field-mapping.md), jadi key mapping
  // HARUS menyertakan arah supaya user bisa atur note/kategori BEDA
  // untuk "akun ini net masuk" vs "akun ini net keluar".
  return [...totals.values()].map((total) => ({
    ...total,
    key: `summary:${total.net >= 0 ? "inflow" : "outflow"}:${total.retailkuAccountId}`,
  }));
}
