import { getDb } from "@/lib/db";
import type { QueueableTable } from "../push-queue";

export async function getAllIds(table: QueueableTable): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ id: string }[]>(`SELECT id FROM ${table}`);
  return rows.map((row) => row.id);
}
