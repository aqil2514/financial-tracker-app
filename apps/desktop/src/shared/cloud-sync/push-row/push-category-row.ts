import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushCategory } from "../worker-client";

export async function pushCategoryRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      name: string;
      icon: string | null;
      type: "income" | "expense";
      parent_id: string | null;
      is_active: number;
      updated_at: string | null;
    }[]
  >("SELECT id, name, icon, type, parent_id, is_active, updated_at FROM categories WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) return null;
  return pushCategory(creds, {
    id: row.id,
    name: row.name,
    icon: row.icon,
    type: row.type,
    parentId: row.parent_id,
    isActive: !!row.is_active,
    updatedAt: row.updated_at ?? undefined,
  });
}
