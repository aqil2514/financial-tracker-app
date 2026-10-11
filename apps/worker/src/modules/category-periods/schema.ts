import { isValidUpdatedAt } from "../../shared/lww";

// Payload POST /category-periods/push -- upsert-by-id MURNI (pola
// pushDebtFromPc di debts/service.ts), bukan create-dgn-business-logic.
// `categoryIds` BUKAN string[] polos -- tiap entry py `id` sendiri krn
// pivot `category_period_categories.id` jg berasal dari caller (desktop
// generate uuidv7, BUKAN Worker), lihat "Revisi: many-to-many kategori"
// di docs/todos/plan/category-period.md. Replace-all: SELURUH pivot
// lama periode ini dihapus lalu di-INSERT ulang persis isi array ini,
// bukan diff (pola desktop use-update-category-period.ts).
export type CategoryPeriodCategoryEntry = {
  id: string;
  categoryId: string;
};

export type CategoryPeriodPayload = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  categoryIds: CategoryPeriodCategoryEntry[];
  updatedAt?: string;
};

function isCategoryPeriodCategoryEntry(value: unknown): value is CategoryPeriodCategoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && v.id.length > 0 && typeof v.categoryId === "string" && v.categoryId.length > 0;
}

export function isCategoryPeriodPayload(value: unknown): value is CategoryPeriodPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    typeof v.startDate === "string" &&
    typeof v.endDate === "string" &&
    Array.isArray(v.categoryIds) &&
    v.categoryIds.every(isCategoryPeriodCategoryEntry) &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}
