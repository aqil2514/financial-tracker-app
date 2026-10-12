import type { Env } from "../../../../shared/env";

export type DebtRow = {
  id: string;
  type: "receivable" | "payable";
  contactId: string | null;
  amount: number;
  accountId: string | null;
  transactionId: string | null;
  status: "ongoing" | "paid" | "written_off";
  note: string | null;
  date: string;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

type DebtDbRow = {
  id: string;
  type: "receivable" | "payable";
  contact_id: string | null;
  amount: number;
  account_id: string | null;
  transaction_id: string | null;
  status: "ongoing" | "paid" | "written_off";
  note: string | null;
  date: string;
  source: "manual" | "retailku_sync";
  source_ref: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchDebts(env: Env, filter: string, bind: unknown[]): Promise<DebtRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, type, contact_id, amount, account_id, transaction_id, status, note, date,
            source, source_ref, updated_at, deleted_at
     FROM debts ${filter}`
  )
    .bind(...bind)
    .all<DebtDbRow>();

  return results.map((r) => ({
    id: r.id,
    type: r.type,
    contactId: r.contact_id,
    amount: r.amount,
    accountId: r.account_id,
    transactionId: r.transaction_id,
    status: r.status,
    note: r.note,
    date: r.date,
    source: r.source,
    sourceRef: r.source_ref,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
