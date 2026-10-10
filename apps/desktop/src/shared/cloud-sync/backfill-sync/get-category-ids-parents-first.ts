import { getDb } from "@/lib/db";

export async function getCategoryIdsParentsFirst(): Promise<string[]> {
  const db = await getDb();
  const parents = await db.select<{ id: string }[]>("SELECT id FROM categories WHERE parent_id IS NULL");
  const children = await db.select<{ id: string }[]>("SELECT id FROM categories WHERE parent_id IS NOT NULL");
  return [...parents.map((row) => row.id), ...children.map((row) => row.id)];
}
