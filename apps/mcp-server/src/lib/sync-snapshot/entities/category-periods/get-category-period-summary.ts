import { datePart, isAlive } from "../../shared";
import type { SyncSnapshot, Transaction } from "../../types";

export function getCategoryPeriodSummary(
  snapshot: SyncSnapshot,
  periodId: string
): {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
} | null {
  const period = snapshot.categoryPeriods.find((p) => p.id === periodId && isAlive(p));
  if (!period) return null;

  const transactions = snapshot.transactions.filter(
    (t) =>
      isAlive(t) &&
      t.categoryId !== null &&
      period.categoryIds.includes(t.categoryId) &&
      datePart(t.date) >= period.startDate &&
      datePart(t.date) <= period.endDate
  );

  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of transactions) {
    if (t.type === "income") totalIncome += t.amount;
    else if (t.type === "expense") totalExpense += t.amount;
  }

  return {
    id: period.id,
    name: period.name,
    startDate: period.startDate,
    endDate: period.endDate,
    totalIncome,
    totalExpense,
    transactions,
  };
}
