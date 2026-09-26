import type { Db, RetailkuSyncFieldMappingRow } from "../types";

type FieldMappingDbRow = {
  key: string;
  local_account_id: number;
  note: string | null;
  category_id: number | null;
  description: string | null;
};

/**
 * Mapping field non-fakta (`local_account_id` WAJIB + `note`/
 * `category_id`/`description` OPSIONAL) per `key`, lihat
 * docs/todos/plan/retailku-sync-field-mapping.md. Menggantikan
 * `loadAccountMapping` lama (`retailku_account_mapping`, keyed by
 * `retailku_account_id` saja) — key di sini sudah mencakup identitas
 * akun DI DALAMNYA (lihat bentuk key di `aggregate-by-*.ts`), jadi
 * lookup-nya langsung by `key` hasil agregasi, bukan by akun mentah.
 */
export async function loadFieldMapping(db: Db): Promise<Map<string, RetailkuSyncFieldMappingRow>> {
  const rows = await db.select<FieldMappingDbRow[]>(
    "SELECT key, local_account_id, note, category_id, description FROM retailku_sync_field_mapping"
  );
  return new Map(
    rows.map((row) => [
      row.key,
      {
        key: row.key,
        localAccountId: row.local_account_id,
        note: row.note,
        categoryId: row.category_id,
        description: row.description,
      },
    ])
  );
}
