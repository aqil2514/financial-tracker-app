import type Database from "@tauri-apps/plugin-sql";

import { logRejectedRow } from "./log-rejected-row";
import type { SyncResponse } from "./types";
import { upsertForexAccount } from "./upsert-forex-account";
import { wins } from "./wins";

export async function applyForexAccountRow(
  db: Database,
  row: SyncResponse["forexAccounts"][number]
): Promise<void> {
  const rows = await db.select<{ updated_at: string | null }[]>(
    "SELECT updated_at FROM forex_accounts WHERE account_id = $1",
    [row.accountId]
  );
  if (!wins(row.updatedAt, rows[0]?.updated_at ?? null)) return;

  try {
    if (row.deletedAt !== null) {
      await db.execute("DELETE FROM forex_accounts WHERE account_id = $1", [row.accountId]);
      return;
    }

    await upsertForexAccount(db, row);
  } catch (error) {
    // Parent (accounts) belum ter-pull: catat dan coba lagi di pull berikutnya.
    await logRejectedRow(db, "forex_accounts", row.accountId, error);
  }
}
