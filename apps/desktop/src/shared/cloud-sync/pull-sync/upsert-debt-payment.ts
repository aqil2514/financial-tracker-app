import type Database from "@tauri-apps/plugin-sql";

import { hasLocalSourceRefConflict } from "./has-local-source-ref-conflict";
import type { SyncResponse } from "./types";

export async function upsertDebtPayment(db: Database, row: SyncResponse["debtPayments"][number]) {
  if (await hasLocalSourceRefConflict(db, "debt_payments", row)) return;
  await db.execute(
    `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, note, date, source, source_ref, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET debt_id = excluded.debt_id, amount = excluded.amount, account_id = excluded.account_id,
       transaction_id = excluded.transaction_id, note = excluded.note, date = excluded.date,
       source = CASE WHEN excluded.source = 'retailku_sync' THEN excluded.source ELSE debt_payments.source END,
       source_ref = CASE WHEN excluded.source = 'retailku_sync' THEN excluded.source_ref ELSE debt_payments.source_ref END,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.debtId,
      row.amount,
      row.accountId,
      row.transactionId,
      row.note,
      row.date,
      row.source,
      row.sourceRef,
      row.updatedAt,
    ]
  );
}
