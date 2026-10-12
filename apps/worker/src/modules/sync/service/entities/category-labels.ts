import type { Env } from "../../../../shared/env";

export type CategoryLabelRow = {
  id: string;
  categoryId: string;
  labelId: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type CategoryLabelDbRow = {
  id: string;
  category_id: string;
  label_id: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchCategoryLabels(
  env: Env,
  filter: string,
  bind: unknown[]
): Promise<CategoryLabelRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, category_id, label_id, updated_at, deleted_at FROM category_labels ${filter}`
  )
    .bind(...bind)
    .all<CategoryLabelDbRow>();

  return results.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    labelId: r.label_id,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
