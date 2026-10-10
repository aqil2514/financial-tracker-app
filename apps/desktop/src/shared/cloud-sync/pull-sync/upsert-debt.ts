import type Database from "@tauri-apps/plugin-sql";

import { hasLocalSourceRefConflict } from "./has-local-source-ref-conflict";
import type { SyncResponse } from "./types";

export async function upsertDebt(db: Database, row: SyncResponse["debts"][number]) {
  if (await hasLocalSourceRefConflict(db, "debts", row)) return;
  await db.execute(
    `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, status, note, date, source, source_ref, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET type = excluded.type, contact_id = excluded.contact_id, amount = excluded.amount,
       account_id = excluded.account_id, transaction_id = excluded.transaction_id, status = excluded.status,
       note = excluded.note, date = excluded.date,
       source = CASE WHEN excluded.source = 'retailku_sync' THEN excluded.source ELSE debts.source END,
       source_ref = CASE WHEN excluded.source = 'retailku_sync' THEN excluded.source_ref ELSE debts.source_ref END,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.type,
      row.contactId,
      row.amount,
      row.accountId,
      row.transactionId,
      row.status,
      row.note,
      row.date,
      row.source,
      row.sourceRef,
      row.updatedAt,
    ]
  );
}
