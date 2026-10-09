import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { pushOnWrite, detachLabelOnWrite } from "@/shared/cloud-sync/push-on-write";

type CategoryLabelRow = { id: string; label_id: string };

/** Sama persis apply-transaction-labels.ts, tabel `category_labels`
 * (bukan `transaction_labels`) -- lihat komentar lengkap di sana. */
export async function applyCategoryLabels(categoryId: string, labelIds: string[]): Promise<void> {
  const db = await getDb();
  const current = await db.select<CategoryLabelRow[]>(
    "SELECT id, label_id FROM category_labels WHERE category_id = $1 AND deleted_at IS NULL",
    [categoryId]
  );
  const currentByLabelId = new Map(current.map((row) => [row.label_id, row.id]));
  const nextLabelIds = new Set(labelIds);

  for (const labelId of labelIds) {
    if (currentByLabelId.has(labelId)) continue;
    const id = newId();
    await db.execute(
      "INSERT INTO category_labels (id, category_id, label_id) VALUES ($1, $2, $3)",
      [id, categoryId, labelId]
    );
    void pushOnWrite("category_labels", id);
  }

  for (const row of current) {
    if (nextLabelIds.has(row.label_id)) continue;
    await db.execute("UPDATE category_labels SET deleted_at = datetime('now') WHERE id = $1", [row.id]);
    void detachLabelOnWrite("categories", categoryId, row.label_id);
  }
}
