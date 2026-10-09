import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { LabelScope } from "./use-labels";

/**
 * Mengubah daftar NAMA label (hasil pilihan combobox multi-select, bisa
 * campuran label existing + nama baru yang diketik user) menjadi daftar
 * `label_id`. Pola sama `resolveContactId` (match case-insensitive by
 * name, buat baru kalau belum ada) tapi utk BANYAK nama sekaligus --
 * dipanggil dari mutationFn create/update transaksi SEBELUM attach ke
 * `transaction_labels` (lihat apply-transaction-labels.ts).
 */
export async function resolveLabelIds(names: string[], scope: LabelScope): Promise<string[]> {
  const trimmed = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0))];
  if (trimmed.length === 0) return [];

  const db = await getDb();
  const existing = await db.select<{ id: string; name: string }[]>(
    "SELECT id, name FROM labels WHERE scope = $1 AND deleted_at IS NULL",
    [scope]
  );
  const existingByLowerName = new Map(existing.map((row) => [row.name.toLowerCase(), row.id]));

  const ids: string[] = [];
  for (const name of trimmed) {
    const existingId = existingByLowerName.get(name.toLowerCase());
    if (existingId) {
      ids.push(existingId);
      continue;
    }

    const id = newId();
    await db.execute("INSERT INTO labels (id, name, scope) VALUES ($1, $2, $3)", [id, name, scope]);
    void pushOnWrite("labels", id);
    ids.push(id);
  }
  return ids;
}
