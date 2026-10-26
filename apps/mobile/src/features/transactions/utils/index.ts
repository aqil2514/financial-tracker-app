import { TransactionListItem } from "../types";

export function groupByDate(transactions: TransactionListItem[]) {
  const groups = new Map<string, TransactionListItem[]>();
  for (const transaction of transactions) {
    const existing = groups.get(transaction.date) ?? [];
    existing.push(transaction);
    groups.set(transaction.date, existing);
  }
  return Array.from(groups.entries()).map(([date, data]) => ({
    title: date,
    data,
  }));
}

export function formatDateLabel(date: string) {
  return new Date(date).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}