import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";
import { upsertInvestmentAccount } from "./upsert-investment-account";
import { wins } from "./wins";

export async function applyInvestmentAccountRow(
  db: Database,
  row: SyncResponse["investmentAccounts"][number]
): Promise<void> {
  const rows = await db.select<{ updated_at: string | null }[]>(
    "SELECT updated_at FROM investment_accounts WHERE account_id = $1",
    [row.accountId]
  );
  if (!wins(row.updatedAt, rows[0]?.updated_at ?? null)) return;

  if (row.deletedAt !== null) {
    await db.execute("DELETE FROM investment_accounts WHERE account_id = $1", [row.accountId]);
    return;
  }

  await upsertInvestmentAccount(db, row);
}
