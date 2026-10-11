import type Database from "@tauri-apps/plugin-sql";

import { newId } from "@/lib/id";
import type { SyncResponse } from "./types";

export async function upsertCategoryPeriod(db: Database, row: SyncResponse["categoryPeriods"][number]) {
  await db.execute(
    `INSERT INTO category_periods (id, name, start_date, end_date, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.name, row.startDate, row.endDate, row.updatedAt]
  );

  await db.execute("DELETE FROM category_period_categories WHERE period_id = $1", [row.id]);
  for (const categoryId of row.categoryIds) {
    await db.execute(
      `INSERT INTO category_period_categories
         (id, period_id, category_id, updated_at, deleted_at, sync_source)
       VALUES ($1, $2, $3, $4, NULL, 'mcp')`,
      [newId(), row.id, categoryId, row.updatedAt]
    );
  }
}
