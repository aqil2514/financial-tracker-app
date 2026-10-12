import type { Env } from "../../../../shared/env";

export type AccountLabelRow = {
  id: string;
  accountId: string;
  labelId: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type AccountLabelDbRow = {
  id: string;
  account_id: string;
  label_id: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchAccountLabels(env: Env, filter: string, bind: unknown[]): Promise<AccountLabelRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, account_id, label_id, updated_at, deleted_at FROM account_labels ${filter}`
  )
    .bind(...bind)
    .all<AccountLabelDbRow>();

  return results.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    labelId: r.label_id,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
