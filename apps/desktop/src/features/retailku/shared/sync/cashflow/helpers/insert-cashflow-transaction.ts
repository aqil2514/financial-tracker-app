import { newId } from "@/lib/id";
import type { Db } from "../types";

export async function insertCashflowTransaction(
  db: Db,
  params: {
    accountId: string;
    amount: number;
    date: string;
    note: string;
    categoryId: string | null;
    description: string | null;
    sourceRef: string;
  }
): Promise<void> {
  const type = params.amount >= 0 ? "income" : "expense";
  await db.execute(
    `INSERT INTO transactions (id, type, amount, account_id, note, category_id, description, date, source, source_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'retailku_sync', $9)`,
    [
      newId(),
      type,
      Math.abs(params.amount),
      params.accountId,
      params.note,
      params.categoryId,
      params.description,
      `${params.date}T00:00`,
      params.sourceRef,
    ]
  );
}
