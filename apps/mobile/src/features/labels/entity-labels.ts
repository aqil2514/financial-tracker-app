import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database/generate-id";
import type { LabelScope } from "./types";

export type LabelEntity = "transaction" | "category" | "account";

const JUNCTION: Record<LabelEntity, { table: string; column: string }> = {
  transaction: { table: "transaction_labels", column: "transaction_id" },
  category: { table: "category_labels", column: "category_id" },
  account: { table: "account_labels", column: "account_id" },
};

// Scope kamus per entitas: transaksi dan kategori berbagi `transaction_category`.
export const ENTITY_LABEL_SCOPE: Record<LabelEntity, LabelScope> = {
  transaction: "transaction_category",
  category: "transaction_category",
  account: "account",
};

export async function loadEntityLabelNames(db: SQLiteDatabase, entity: LabelEntity, entityId: string) {
  const { table, column } = JUNCTION[entity];
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT l.name AS name FROM ${table} j JOIN labels l ON l.id = j.label_id
     WHERE j.${column} = ? ORDER BY l.name COLLATE NOCASE`,
    [entityId]
  );
  return rows.map((row) => row.name);
}

// Nama (hasil pilihan, bisa campuran label lama dan nama baru yang diketik) -> id. Cocok tanpa membedakan
// huruf besar/kecil; nama yang belum ada dibuat sebagai label baru.
export async function resolveLabelIds(db: SQLiteDatabase, names: string[], scope: LabelScope) {
  const byLowerName = new Map<string, string>();
  for (const name of names.map((item) => item.trim()).filter((item) => item.length > 0)) {
    if (!byLowerName.has(name.toLowerCase())) byLowerName.set(name.toLowerCase(), name);
  }
  const trimmed = [...byLowerName.values()];
  if (trimmed.length === 0) return [];

  const existing = await db.getAllAsync<{ id: string; name: string }>(
    "SELECT id, name FROM labels WHERE scope = ?",
    [scope]
  );
  const idByLowerName = new Map(existing.map((row) => [row.name.toLowerCase(), row.id]));

  const ids: string[] = [];
  for (const name of trimmed) {
    let id = idByLowerName.get(name.toLowerCase());
    if (!id) {
      id = generateId();
      await db.runAsync("INSERT INTO labels (id, name, scope) VALUES (?, ?, ?)", [id, name, scope]);
      idByLowerName.set(name.toLowerCase(), id);
    }
    ids.push(id);
  }
  return ids;
}

// Samakan label yang menempel di entitas dengan `names`: pasang yang baru, lepas yang tidak dipilih lagi.
// Diff (bukan hapus-semua lalu isi ulang) supaya pemasangan yang tidak berubah tidak masuk antrean sync.
export async function applyEntityLabels(
  db: SQLiteDatabase,
  entity: LabelEntity,
  entityId: string,
  names: string[]
) {
  const { table, column } = JUNCTION[entity];
  const labelIds = await resolveLabelIds(db, names, ENTITY_LABEL_SCOPE[entity]);
  const wanted = new Set(labelIds);

  const current = await db.getAllAsync<{ id: string; label_id: string }>(
    `SELECT id, label_id FROM ${table} WHERE ${column} = ?`,
    [entityId]
  );
  const currentLabelIds = new Set(current.map((row) => row.label_id));

  for (const row of current) {
    if (!wanted.has(row.label_id)) await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [row.id]);
  }
  for (const labelId of labelIds) {
    if (currentLabelIds.has(labelId)) continue;
    await db.runAsync(`INSERT INTO ${table} (id, ${column}, label_id) VALUES (?, ?, ?)`, [
      generateId(),
      entityId,
      labelId,
    ]);
  }
}
