import type { TransactionListItem } from "@/features/transactions/types";
import type { BreakdownChartRow } from "../shared/breakdown-chart-data";

export const PERIOD_COLORS = { income: "#22c55e", expense: "#ef4444" } as const;

export interface PeriodSummary {
  income: number;
  expense: number;
}

// Ringkasan dihitung dari daftar transaksi periode (bukan query SUM terpisah seperti desktop) —
// filter dan rentangnya sama, jadi hasilnya identik dengan satu query saja.
export function summarizePeriod(transactions: TransactionListItem[]): PeriodSummary {
  const summary = { income: 0, expense: 0 };
  for (const tx of transactions) {
    if (tx.type === "income") summary.income += tx.amount;
    else if (tx.type === "expense") summary.expense += tx.amount;
  }
  return summary;
}

// Dua irisan (Pemasukan, Pengeluaran) dengan warna tetap; irisan bernilai 0 dibuang, seperti desktop.
// Persen dihitung terhadap jumlah keduanya.
export function toPeriodPieRows(summary: PeriodSummary): BreakdownChartRow[] {
  const total = summary.income + summary.expense;
  return [
    { group_key: "income", label: "Pemasukan", total: summary.income, color: PERIOD_COLORS.income },
    { group_key: "expense", label: "Pengeluaran", total: summary.expense, color: PERIOD_COLORS.expense },
  ]
    .filter((row) => row.total > 0)
    .map((row) => ({ ...row, percent: (row.total / total) * 100 }));
}

export interface DailyIncomeExpense {
  dates: string[];
  income: number[];
  expense: number[];
}

// Pemasukan dan pengeluaran per tanggal kalender (bukan per timestamp), urut naik, untuk grafik tren.
export function dailyIncomeExpense(transactions: TransactionListItem[]): DailyIncomeExpense {
  const byDate = new Map<string, { income: number; expense: number }>();
  for (const tx of transactions) {
    const date = tx.date.slice(0, 10);
    const entry = byDate.get(date) ?? { income: 0, expense: 0 };
    if (tx.type === "income") entry.income += tx.amount;
    else if (tx.type === "expense") entry.expense += tx.amount;
    byDate.set(date, entry);
  }

  const dates = Array.from(byDate.keys()).sort();
  return {
    dates,
    income: dates.map((date) => byDate.get(date)!.income),
    expense: dates.map((date) => byDate.get(date)!.expense),
  };
}
