import type { Env } from "../../../../shared/env";

export type TransactionLabelRow = {
  id: string;
  transactionId: string;
  labelId: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

type TransactionLabelDbRow = {
  id: string;
  transaction_id: string;
  label_id: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchTransactionLabels(
  env: Env,
  filter: string,
  bind: unknown[]
): Promise<TransactionLabelRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, transaction_id, label_id, updated_at, deleted_at FROM transaction_labels ${filter}`
  )
    .bind(...bind)
    .all<TransactionLabelDbRow>();

  return results.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    labelId: r.label_id,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
