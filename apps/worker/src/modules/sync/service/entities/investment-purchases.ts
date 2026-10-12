import type { Env } from "../../../../shared/env";

export type InvestmentPurchaseRow = {
  id: string;
  accountId: string;
  transactionId: string | null;
  unit: number | null;
  pricePerUnit: number | null;
  date: string;
  status: "pending" | "settled";
  updatedAt: string | null;
  deletedAt: string | null;
};

type InvestmentPurchaseDbRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  unit: number | null;
  price_per_unit: number | null;
  date: string;
  status: "pending" | "settled";
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchInvestmentPurchases(
  env: Env,
  filter: string,
  bind: unknown[]
): Promise<InvestmentPurchaseRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, updated_at, deleted_at
     FROM investment_purchases ${filter}`
  )
    .bind(...bind)
    .all<InvestmentPurchaseDbRow>();

  return results.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    transactionId: r.transaction_id,
    unit: r.unit,
    pricePerUnit: r.price_per_unit,
    date: r.date,
    status: r.status,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
