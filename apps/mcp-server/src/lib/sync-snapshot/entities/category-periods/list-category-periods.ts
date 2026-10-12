import { isAlive } from "../../shared";
import type { CategoryPeriod, SyncSnapshot } from "../../types";

export function listCategoryPeriods(
  snapshot: SyncSnapshot,
  options: { name?: string; categoryId?: string } = {}
): CategoryPeriod[] {
  const nameLower = options.name?.toLowerCase();
  return snapshot.categoryPeriods
    .filter(isAlive)
    .filter((p) => !nameLower || p.name.toLowerCase().includes(nameLower))
    .filter((p) => !options.categoryId || p.categoryIds.includes(options.categoryId));
}
