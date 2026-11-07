import { getDb } from "@/lib/db";
import type { QueueableTable } from "../push-queue";

export async function getAllIds(table: QueueableTable): Promise<string[]> {
  const db = await getDb();
  // forex_accounts memakai account_id sebagai PK (1:1 dengan accounts), bukan kolom id.
  const idColumn = table === "forex_accounts" ? "account_id" : "id";
  const rows = await db.select<{ id: string }[]>(`SELECT ${idColumn} AS id FROM ${table}`);
  return rows.map((row) => row.id);
}
