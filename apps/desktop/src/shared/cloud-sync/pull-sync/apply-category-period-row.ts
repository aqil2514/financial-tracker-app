import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";
import { upsertCategoryPeriod } from "./upsert-category-period";
import { wins } from "./wins";

export async function applyCategoryPeriodRow(
  db: Database,
  row: SyncResponse["categoryPeriods"][number]
): Promise<void> {
  const rows = await db.select<{ updated_at: string | null }[]>(
    "SELECT updated_at FROM category_periods WHERE id = $1",
    [row.id]
  );
  if (!wins(row.updatedAt, rows[0]?.updated_at ?? null)) return;

  if (row.deletedAt !== null) {
    await db.execute("DELETE FROM category_periods WHERE id = $1", [row.id]);
    return;
  }

  await upsertCategoryPeriod(db, row);
}
