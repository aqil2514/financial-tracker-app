import type { Env } from "../../../../shared/env";

export type ForexAccountRow = {
  accountId: string;
  country: string;
  currency: string;
  currentRate: number;
  updatedAt: string | null;
  deletedAt: string | null;
};

type ForexAccountDbRow = {
  account_id: string;
  country: string;
  currency: string;
  current_rate: number;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchForexAccounts(env: Env, filter: string, bind: unknown[]): Promise<ForexAccountRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT account_id, country, currency, current_rate, updated_at, deleted_at FROM forex_accounts ${filter}`
  )
    .bind(...bind)
    .all<ForexAccountDbRow>();

  return results.map((r) => ({
    accountId: r.account_id,
    country: r.country,
    currency: r.currency,
    currentRate: r.current_rate,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
