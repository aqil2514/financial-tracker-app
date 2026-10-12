import type { Env } from "../../../../shared/env";

export type CategoryPeriodRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  categoryIds: string[];
  updatedAt: string | null;
  deletedAt: string | null;
};

type CategoryPeriodDbRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  updated_at: string | null;
  deleted_at: string | null;
  category_ids: string | null;
};

export async function fetchCategoryPeriods(env: Env, since: string | null): Promise<CategoryPeriodRow[]> {
  const filter = since !== null ? "WHERE category_periods.updated_at > ?1" : "";
  const bind = since !== null ? [since] : [];

  const { results } = await env.DB.prepare(
    `SELECT category_periods.id, category_periods.name, category_periods.start_date,
            category_periods.end_date, category_periods.updated_at, category_periods.deleted_at,
            GROUP_CONCAT(category_period_categories.category_id) AS category_ids
     FROM category_periods
     LEFT JOIN category_period_categories
       ON category_period_categories.period_id = category_periods.id
      AND category_period_categories.deleted_at IS NULL
     ${filter}
     GROUP BY category_periods.id`
  )
    .bind(...bind)
    .all<CategoryPeriodDbRow>();

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    categoryIds: r.category_ids ? r.category_ids.split(",") : [],
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
