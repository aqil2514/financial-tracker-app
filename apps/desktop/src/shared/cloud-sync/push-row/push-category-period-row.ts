import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushCategoryPeriod } from "../worker-client";

export async function pushCategoryPeriodRow(
  creds: CloudSyncCredentials,
  id: string
): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    { id: string; name: string; start_date: string; end_date: string; updated_at: string | null }[]
  >("SELECT id, name, start_date, end_date, updated_at FROM category_periods WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) return null;

  const pivotRows = await db.select<{ id: string; category_id: string }[]>(
    "SELECT id, category_id FROM category_period_categories WHERE period_id = $1 AND deleted_at IS NULL",
    [id]
  );

  return pushCategoryPeriod(creds, {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    categoryIds: pivotRows.map((p) => ({ id: p.id, categoryId: p.category_id })),
    updatedAt: row.updated_at ?? undefined,
  });
}
