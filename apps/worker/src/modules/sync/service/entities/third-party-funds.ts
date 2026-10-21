import type { Env } from "../../../../shared/env";

export type ThirdPartyFundRow = {
  id: string;
  accountId: string;
  contactId: string;
  transactionId: string | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  note: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

type ThirdPartyFundDbRow = {
  id: string;
  account_id: string;
  contact_id: string;
  transaction_id: string | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  note: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchThirdPartyFunds(
  env: Env,
  filter: string,
  bind: unknown[]
): Promise<ThirdPartyFundRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, account_id, contact_id, transaction_id, direction, amount, date, note, updated_at, deleted_at
     FROM third_party_funds ${filter}`
  )
    .bind(...bind)
    .all<ThirdPartyFundDbRow>();

  return results.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    contactId: r.contact_id,
    transactionId: r.transaction_id,
    direction: r.direction,
    amount: r.amount,
    date: r.date,
    note: r.note,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
