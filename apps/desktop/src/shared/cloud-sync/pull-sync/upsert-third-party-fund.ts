import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertThirdPartyFund(db: Database, row: SyncResponse["thirdPartyFunds"][number]) {
  await db.execute(
    `INSERT INTO third_party_funds (id, account_id, contact_id, transaction_id, direction, amount, date, note, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, contact_id = excluded.contact_id,
       transaction_id = excluded.transaction_id, direction = excluded.direction, amount = excluded.amount,
       date = excluded.date, note = excluded.note, updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.accountId,
      row.contactId,
      row.transactionId,
      row.direction,
      row.amount,
      row.date,
      row.note,
      row.updatedAt,
    ]
  );
}
