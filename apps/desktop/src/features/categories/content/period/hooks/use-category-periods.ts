import { useQuery } from "@tanstack/react-query";
import { getDb, type CategoryPeriod } from "@/lib/db";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";

export const categoryPeriodsQueryKey = ["category_periods"];

export type CategoryPeriodWithCategories = CategoryPeriod & {
  category_names: string;
  is_ongoing: 0 | 1;
};

const FILTERABLE_COLUMNS = ["category_periods.name"] as const;

export function useCategoryPeriods(filters: FilterConfig[] = []) {
  const categoryFilter = filters.find((f) => f.filterKey === "category_id");
  const statusFilter = filters.find((f) => f.filterKey === "status");
  const genericFilters = filters.filter(
    (f) => f.filterKey !== "category_id" && f.filterKey !== "status"
  );

  const extraConditions: { condition: string; params?: (string | number)[] }[] = [];

  const categoryIds = Array.isArray(categoryFilter?.filterValue)
    ? categoryFilter.filterValue.map(String)
    : [];

  if (categoryIds.length > 0) {
    const startIndex = extraConditions.length + 1;
    const placeholders = categoryIds.map((_, i) => `$${startIndex + i}`).join(", ");
    extraConditions.push({
      condition: `EXISTS (
        SELECT 1 FROM category_period_categories cpc
        WHERE cpc.period_id = category_periods.id AND cpc.category_id IN (${placeholders})
      )`,
      params: categoryIds,
    });
  }

  const statusValues = Array.isArray(statusFilter?.filterValue)
    ? statusFilter.filterValue.map(String)
    : [];
  const wantsOngoing = statusValues.includes("ongoing");
  const wantsDone = statusValues.includes("done");

  if (wantsOngoing && !wantsDone) {
    extraConditions.push({
      condition: "date('now') BETWEEN category_periods.start_date AND category_periods.end_date",
    });
  } else if (wantsDone && !wantsOngoing) {
    extraConditions.push({
      condition: "date('now') NOT BETWEEN category_periods.start_date AND category_periods.end_date",
    });
  }

  const { whereClause, params } = buildWhereClause(
    genericFilters,
    FILTERABLE_COLUMNS,
    extraConditions
  );

  return useQuery({
    queryKey: [...categoryPeriodsQueryKey, filters],
    queryFn: async (): Promise<CategoryPeriodWithCategories[]> => {
      const db = await getDb();
      return db.select<CategoryPeriodWithCategories[]>(
        `SELECT category_periods.*,
                GROUP_CONCAT(categories.name, ', ') AS category_names,
                (date('now') BETWEEN category_periods.start_date AND category_periods.end_date) AS is_ongoing
         FROM category_periods
         JOIN category_period_categories
           ON category_period_categories.period_id = category_periods.id
         JOIN categories
           ON categories.id = category_period_categories.category_id
         ${whereClause}
         GROUP BY category_periods.id
         ORDER BY is_ongoing DESC, category_periods.start_date DESC`,
        params
      );
    },
  });
}
