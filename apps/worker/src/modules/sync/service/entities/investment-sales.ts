import type { Env } from "../../../../shared/env";

export type InvestmentSaleRow = {
  id: string;
  accountId: string;
  transactionId: string | null;
  adjustmentTransactionId: string | null;
  unit: number;
  pricePerUnit: number;
  averageCostPerUnit: number | null;
  realizedPl: number | null;
  date: string;
  status: "pending" | "settled";
  updatedAt: string | null;
  deletedAt: string | null;
};

type InvestmentSaleDbRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  adjustment_transaction_id: string | null;
  unit: number;
  price_per_unit: number;
  average_cost_per_unit: number | null;
  realized_pl: number | null;
  date: string;
  status: "pending" | "settled";
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchInvestmentSales(
  env: Env,
  filter: string,
  bind: unknown[]
): Promise<InvestmentSaleRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit,
            average_cost_per_unit, realized_pl, date, status, updated_at, deleted_at
     FROM investment_sales ${filter}`
  )
    .bind(...bind)
    .all<InvestmentSaleDbRow>();

  return results.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    transactionId: r.transaction_id,
    adjustmentTransactionId: r.adjustment_transaction_id,
    unit: r.unit,
    pricePerUnit: r.price_per_unit,
    averageCostPerUnit: r.average_cost_per_unit,
    realizedPl: r.realized_pl,
    date: r.date,
    status: r.status,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
