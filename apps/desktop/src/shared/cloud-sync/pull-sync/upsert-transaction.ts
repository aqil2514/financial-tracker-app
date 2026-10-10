import type Database from "@tauri-apps/plugin-sql";

import { hasLocalSourceRefConflict } from "./has-local-source-ref-conflict";
import type { SyncResponse } from "./types";

export async function upsertTransaction(db: Database, row: SyncResponse["transactions"][number]) {
  if (await hasLocalSourceRefConflict(db, "transactions", row)) return;
  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id, source, source_ref, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET type = excluded.type, amount = excluded.amount, category_id = excluded.category_id,
       account_id = excluded.account_id, transfer_account_id = excluded.transfer_account_id, note = excluded.note,
       description = excluded.description, date = excluded.date, contact_id = excluded.contact_id,
       source = excluded.source, source_ref = excluded.source_ref,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.type,
      row.amount,
      row.categoryId,
      row.accountId,
      row.transferAccountId,
      row.note,
      row.description,
      row.date,
      row.contactId,
      row.source,
      row.sourceRef,
      row.updatedAt,
    ]
  );
}
