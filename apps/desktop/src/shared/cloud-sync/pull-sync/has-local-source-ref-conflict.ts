import type Database from "@tauri-apps/plugin-sql";

export async function hasLocalSourceRefConflict(
  db: Database,
  table: "transactions" | "debts" | "debt_payments",
  row: { id: string; source: string; sourceRef: string | null }
): Promise<boolean> {
  if (!row.sourceRef) return false;
  const rows = await db.select<{ id: string }[]>(
    `SELECT id FROM ${table} WHERE source = $1 AND source_ref = $2 AND id <> $3 LIMIT 1`,
    [row.source, row.sourceRef, row.id]
  );
  return rows.length > 0;
}
