import type { Env } from "../../../../shared/env";

export type DebtPaymentRow = {
  id: string;
  debtId: string;
  amount: number;
  accountId: string | null;
  transactionId: string | null;
  note: string | null;
  date: string;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

type DebtPaymentDbRow = {
  id: string;
  debt_id: string;
  amount: number;
  account_id: string | null;
  transaction_id: string | null;
  note: string | null;
  date: string;
  source: "manual" | "retailku_sync";
  source_ref: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchDebtPayments(env: Env, filter: string, bind: unknown[]): Promise<DebtPaymentRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, debt_id, amount, account_id, transaction_id, note, date, source, source_ref, updated_at, deleted_at
     FROM debt_payments ${filter}`
  )
    .bind(...bind)
    .all<DebtPaymentDbRow>();

  return results.map((r) => ({
    id: r.id,
    debtId: r.debt_id,
    amount: r.amount,
    accountId: r.account_id,
    transactionId: r.transaction_id,
    note: r.note,
    date: r.date,
    source: r.source,
    sourceRef: r.source_ref,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
