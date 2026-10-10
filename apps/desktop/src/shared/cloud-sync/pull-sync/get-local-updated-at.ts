import type Database from "@tauri-apps/plugin-sql";

export async function getLocalUpdatedAt(db: Database, table: string, id: string): Promise<string | null> {
  const rows = await db.select<{ updated_at: string | null }[]>(
    `SELECT updated_at FROM ${table} WHERE id = $1`,
    [id]
  );
  return rows[0]?.updated_at ?? null;
}
