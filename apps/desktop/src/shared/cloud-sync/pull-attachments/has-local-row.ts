import { getDb } from "@/lib/db";

export async function hasLocalRow(table: string, id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ id: string }[]>(`SELECT id FROM ${table} WHERE id = $1`, [id]);
  return rows.length > 0;
}
