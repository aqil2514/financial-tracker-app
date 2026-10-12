import type { Env } from "../../../../shared/env";

export type CategoryRow = {
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  parentId: string | null;
  isActive: boolean;
  updatedAt: string | null;
  deletedAt: string | null;
};

type CategoryDbRow = {
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  parent_id: string | null;
  is_active: number;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchCategories(env: Env, filter: string, bind: unknown[]): Promise<CategoryRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, icon, type, parent_id, is_active, updated_at, deleted_at FROM categories ${filter}`
  )
    .bind(...bind)
    .all<CategoryDbRow>();

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    type: r.type,
    parentId: r.parent_id,
    isActive: r.is_active === 1,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
