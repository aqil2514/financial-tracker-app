import type { TransactionListItem } from "@/features/transactions/types";
import type { CashflowGroupBy } from "../use-cashflow-breakdown";

export interface CashflowDetailTransaction extends TransactionListItem {
  accountId: string;
  categoryId: string | null;
}

export interface ChildRow {
  value: string;
  label: string;
  total: number;
}

function sum(transactions: CashflowDetailTransaction[]) {
  return transactions.reduce((total, tx) => total + tx.amount, 0);
}

export function totalAmount(transactions: CashflowDetailTransaction[]) {
  return sum(transactions);
}

// "Anak" sebuah grup, sama seperti desktop: akun-akun dalam grup akun, atau kategori anak
// dalam kategori induk. Dihitung dari SELURUH transaksi grup (bukan yang sudah difilter anak)
// supaya total tiap anak tidak ikut berubah saat satu anak dipilih. Transaksi yang langsung
// memakai kategori induk itu sendiri tidak punya baris anak (hanya masuk "Semua").
export function computeChildRows(
  transactions: CashflowDetailTransaction[],
  groupBy: CashflowGroupBy,
  groupKey: string | null
): ChildRow[] {
  const byChild = new Map<string, ChildRow>();

  for (const tx of transactions) {
    let value: string | null;
    let label: string;
    if (groupBy === "account_group") {
      value = tx.accountId;
      label = tx.account;
    } else {
      value = tx.categoryId !== groupKey ? tx.categoryId : null;
      label = tx.category ?? "Tanpa Kategori";
    }
    if (value === null) continue;

    const existing = byChild.get(value);
    if (existing) existing.total += tx.amount;
    else byChild.set(value, { value, label, total: tx.amount });
  }

  return Array.from(byChild.values())
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function filterByChild(
  transactions: CashflowDetailTransaction[],
  groupBy: CashflowGroupBy,
  childId: string | null
): CashflowDetailTransaction[] {
  if (!childId) return transactions;
  return transactions.filter((tx) =>
    groupBy === "account_group" ? tx.accountId === childId : tx.categoryId === childId
  );
}

// Total per tanggal kalender (bukan per timestamp), urut naik, untuk grafik harian.
export function dailyTotals(transactions: CashflowDetailTransaction[]): { date: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const date = tx.date.slice(0, 10);
    totals.set(date, (totals.get(date) ?? 0) + tx.amount);
  }
  return Array.from(totals.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
