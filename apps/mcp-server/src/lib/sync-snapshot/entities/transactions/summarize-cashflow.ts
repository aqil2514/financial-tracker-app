import { datePart, isAlive } from "../../shared";
import type { SyncSnapshot, Transaction } from "../../types";

export type CashflowGroupBy = "account_group" | "parent_category";

export function summarizeCashflow(
  snapshot: SyncSnapshot,
  options: { from?: string; to?: string; groupBy?: CashflowGroupBy } = {}
): {
  income: { total: number; byGroup: Array<{ label: string; total: number }> };
  expense: { total: number; byGroup: Array<{ label: string; total: number }> };
} {
  const groupBy = options.groupBy ?? "account_group";
  const accountById = new Map(snapshot.accounts.map((a) => [a.id, a]));
  const groupNameById = new Map(
    snapshot.accountGroups.filter((g) => g.deletedAt === null).map((g) => [g.id, g.name])
  );
  const categoryById = new Map(snapshot.categories.map((c) => [c.id, c]));

  const labelFor = (t: Transaction): string => {
    if (groupBy === "parent_category") {
      const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
      if (!category) return "Tanpa Kategori";
      const parent = category.parentId ? categoryById.get(category.parentId) : undefined;
      return parent?.name ?? category.name;
    }

    const account = t.accountId ? accountById.get(t.accountId) : undefined;
    return account?.groupId ? (groupNameById.get(account.groupId) ?? "Tanpa Grup") : "Tanpa Grup";
  };

  const totalsByType: Record<"income" | "expense", Map<string, number>> = {
    income: new Map(),
    expense: new Map(),
  };

  for (const t of snapshot.transactions) {
    if (!isAlive(t)) continue;
    if (t.type !== "income" && t.type !== "expense") continue;
    if (t.isCashNeutral) continue;
    if (options.from && datePart(t.date) < options.from) continue;
    if (options.to && datePart(t.date) > options.to) continue;

    const label = labelFor(t);
    const totals = totalsByType[t.type];
    totals.set(label, (totals.get(label) ?? 0) + t.amount);
  }

  const toByGroup = (totals: Map<string, number>) =>
    Array.from(totals.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);

  const sumOf = (totals: Map<string, number>) =>
    Array.from(totals.values()).reduce((sum, v) => sum + v, 0);

  return {
    income: { total: sumOf(totalsByType.income), byGroup: toByGroup(totalsByType.income) },
    expense: { total: sumOf(totalsByType.expense), byGroup: toByGroup(totalsByType.expense) },
  };
}
