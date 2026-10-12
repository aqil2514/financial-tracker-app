import { datePart, isAlive } from "../../shared";
import type { SyncSnapshot } from "../../types";

export function summarizeExpenseByCategory(
  snapshot: SyncSnapshot,
  options: { from?: string; to?: string } = {}
): Array<{ categoryId: string | null; categoryName: string; total: number }> {
  const categoryById = new Map(snapshot.categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();

  for (const t of snapshot.transactions) {
    if (!isAlive(t) || t.type !== "expense") continue;
    if (options.from && datePart(t.date) < options.from) continue;
    if (options.to && datePart(t.date) > options.to) continue;
    const key = t.categoryId ?? "__uncategorized__";
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }

  return Array.from(totals.entries())
    .map(([categoryId, total]) => ({
      categoryId: categoryId === "__uncategorized__" ? null : categoryId,
      categoryName:
        categoryId === "__uncategorized__" ? "Tanpa kategori" : (categoryById.get(categoryId)?.name ?? "Tidak diketahui"),
      total,
    }))
    .sort((a, b) => b.total - a.total);
}
