import type { Env } from "../../../../shared/env";

export type ForexSaleRow = {
  id: string;
  accountId: string;
  transactionId: string | null;
  adjustmentTransactionId: string | null;
  unit: number;
  rate: number;
  averageCostPerUnit: number;
  realizedPl: number;
  date: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type ForexSaleDbRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  adjustment_transaction_id: string | null;
  unit: number;
  rate: number;
  average_cost_per_unit: number;
  realized_pl: number;
  date: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchForexSales(env: Env, filter: string, bind: unknown[]): Promise<ForexSaleRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, rate, average_cost_per_unit,
            realized_pl, date, updated_at, deleted_at
     FROM forex_sales ${filter}`
  )
    .bind(...bind)
    .all<ForexSaleDbRow>();

  return results.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    transactionId: r.transaction_id,
    adjustmentTransactionId: r.adjustment_transaction_id,
    unit: r.unit,
    rate: r.rate,
    averageCostPerUnit: r.average_cost_per_unit,
    realizedPl: r.realized_pl,
    date: r.date,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
