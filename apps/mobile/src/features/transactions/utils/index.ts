import { TransactionListItem } from "../types";

// `transaction.date` sekarang datetime ISO penuh (tanggal+jam) — grouping
// tetap per hari kalender, jadi key-nya cuma bagian tanggal (YYYY-MM-DD),
// bukan string datetime penuh (kalau tidak, transaksi di hari sama tapi
// jam beda jadi dianggap grup terpisah).
function toDateKey(isoDatetime: string): string {
  return isoDatetime.slice(0, 10);
}

export function groupByDate(transactions: TransactionListItem[]) {
  const groups = new Map<string, TransactionListItem[]>();
  for (const transaction of transactions) {
    const key = toDateKey(transaction.date);
    const existing = groups.get(key) ?? [];
    existing.push(transaction);
    groups.set(key, existing);
  }
  return Array.from(groups.entries()).map(([date, data]) => ({
    title: date,
    data,
  }));
}

export function formatDateLabel(dateKey: string) {
  return new Date(dateKey).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTimeLabel(isoDatetime: string) {
  return new Date(isoDatetime).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}