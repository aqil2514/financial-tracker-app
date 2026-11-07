import type { Env } from "../../../../shared/env";

export type ForexPurchaseRow = {
  id: string;
  accountId: string;
  transactionId: string | null;
  unit: number;
  rate: number;
  date: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type ForexPurchaseDbRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  unit: number;
  rate: number;
  date: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchForexPurchases(env: Env, filter: string, bind: unknown[]): Promise<ForexPurchaseRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, account_id, transaction_id, unit, rate, date, updated_at, deleted_at FROM forex_purchases ${filter}`
  )
    .bind(...bind)
    .all<ForexPurchaseDbRow>();

  return results.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    transactionId: r.transaction_id,
    unit: r.unit,
    rate: r.rate,
    date: r.date,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
