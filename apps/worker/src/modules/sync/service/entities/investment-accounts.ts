import type { Env } from "../../../../shared/env";

export type InvestmentAccountRow = {
  accountId: string;
  unitLabel: string;
  currentMarketValue: number;
  updatedAt: string | null;
  deletedAt: string | null;
};

type InvestmentAccountDbRow = {
  account_id: string;
  unit_label: string;
  current_market_value: number;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchInvestmentAccounts(
  env: Env,
  filter: string,
  bind: unknown[]
): Promise<InvestmentAccountRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT account_id, unit_label, current_market_value, updated_at, deleted_at FROM investment_accounts ${filter}`
  )
    .bind(...bind)
    .all<InvestmentAccountDbRow>();

  return results.map((r) => ({
    accountId: r.account_id,
    unitLabel: r.unit_label,
    currentMarketValue: r.current_market_value,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
