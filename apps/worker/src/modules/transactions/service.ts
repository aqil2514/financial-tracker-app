import type { Env } from "../../shared/env";
import type { PushTransactionPayload } from "./schema";

// SENGAJA belum ada validasi logic bisnis (FIFO debt, larangan akun
// `debt` utk income/expense, dst -- lihat checklist porting di
// docs/todos/plan/mcp-server-business-logic-audit.md). Fungsi ini
// murni INSERT, belum UPSERT dgn LWW (`updated_at` selalu ditulis
// baru, belum dibandingkan dgn baris existing).
export async function insertTransaction(env: Env, payload: PushTransactionPayload): Promise<void> {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id,
        note, date, description, contact_id, created_at, updated_at, sync_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pc')`
  )
    .bind(
      payload.id,
      payload.type,
      payload.amount,
      payload.categoryId ?? null,
      payload.accountId ?? null,
      payload.transferAccountId ?? null,
      payload.note,
      payload.date,
      payload.description ?? null,
      payload.contactId ?? null,
      now,
      now
    )
    .run();
}
