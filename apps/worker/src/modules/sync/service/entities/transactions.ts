import type { Env } from "../../../../shared/env";

export type TransactionRow = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  transferAccountId: string | null;
  note: string;
  date: string;
  description: string | null;
  contactId: string | null;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

type TransactionDbRow = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category_id: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  note: string;
  date: string;
  description: string | null;
  contact_id: string | null;
  source: "manual" | "retailku_sync";
  source_ref: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchTransactions(env: Env, filter: string, bind: unknown[]): Promise<TransactionRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
            contact_id, source, source_ref, updated_at, deleted_at
     FROM transactions ${filter}`
  )
    .bind(...bind)
    .all<TransactionDbRow>();

  return results.map((r) => ({
    id: r.id,
    type: r.type,
    amount: r.amount,
    categoryId: r.category_id,
    accountId: r.account_id,
    transferAccountId: r.transfer_account_id,
    note: r.note,
    date: r.date,
    description: r.description,
    contactId: r.contact_id,
    source: r.source,
    sourceRef: r.source_ref,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
