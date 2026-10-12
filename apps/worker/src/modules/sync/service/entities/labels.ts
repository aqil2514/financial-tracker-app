import type { Env } from "../../../../shared/env";

export type LabelRow = {
  id: string;
  name: string;
  scope: "transaction_category" | "account";
  updatedAt: string | null;
  deletedAt: string | null;
};

type LabelDbRow = {
  id: string;
  name: string;
  scope: "transaction_category" | "account";
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchLabels(env: Env, filter: string, bind: unknown[]): Promise<LabelRow[]> {
  const { results } = await env.DB.prepare(`SELECT id, name, scope, updated_at, deleted_at FROM labels ${filter}`)
    .bind(...bind)
    .all<LabelDbRow>();

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.scope,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
