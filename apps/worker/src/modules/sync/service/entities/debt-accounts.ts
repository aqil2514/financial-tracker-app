import type { Env } from "../../../../shared/env";

export type DebtAccountRow = {
  accountId: string;
  direction: "receivable" | "payable";
  updatedAt: string | null;
  deletedAt: string | null;
};

type DebtAccountDbRow = {
  account_id: string;
  direction: "receivable" | "payable";
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchDebtAccounts(
  env: Env,
  filter: string,
  bind: unknown[]
): Promise<DebtAccountRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT account_id, direction, updated_at, deleted_at FROM debt_accounts ${filter}`
  )
    .bind(...bind)
    .all<DebtAccountDbRow>();

  return results.map((r) => ({
    accountId: r.account_id,
    direction: r.direction,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
