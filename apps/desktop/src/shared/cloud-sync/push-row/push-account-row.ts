import { getDb } from "@/lib/db";
import type { AccountType } from "@/lib/account-types";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushAccount } from "../worker-client";

export async function pushAccountRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
      initial_balance: number;
      group_id: string | null;
      description: string | null;
      is_active: number;
      account_type: AccountType;
      updated_at: string | null;
    }[]
  >(
    "SELECT id, name, icon, color, initial_balance, group_id, description, is_active, account_type, updated_at FROM accounts WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushAccount(creds, {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    initialBalance: row.initial_balance,
    groupId: row.group_id,
    description: row.description,
    isActive: !!row.is_active,
    accountType: row.account_type,
    updatedAt: row.updated_at ?? undefined,
  });
}
