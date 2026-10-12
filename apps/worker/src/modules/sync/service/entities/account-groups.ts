import type { Env } from "../../../../shared/env";

export type AccountGroupRow = {
  id: string;
  name: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type AccountGroupDbRow = {
  id: string;
  name: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchAccountGroups(
  env: Env,
  filter: string,
  bind: unknown[]
): Promise<AccountGroupRow[]> {
  const { results } = await env.DB.prepare(`SELECT id, name, updated_at, deleted_at FROM account_groups ${filter}`)
    .bind(...bind)
    .all<AccountGroupDbRow>();

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
