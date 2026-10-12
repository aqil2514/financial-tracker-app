import type { Env } from "../../../../shared/env";
import type { AccountType } from "../../../../shared/account-types";

export type AccountRow = {
  id: string;
  name: string;
  icon: string | null;
  initialBalance: number;
  groupId: string | null;
  description: string | null;
  isActive: boolean;
  accountType: AccountType;
  color: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

type AccountDbRow = {
  id: string;
  name: string;
  icon: string | null;
  initial_balance: number;
  group_id: string | null;
  description: string | null;
  is_active: number;
  account_type: AccountType;
  color: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchAccounts(env: Env, filter: string, bind: unknown[]): Promise<AccountRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, icon, initial_balance, group_id, description, is_active, account_type, color,
            updated_at, deleted_at
     FROM accounts ${filter}`
  )
    .bind(...bind)
    .all<AccountDbRow>();

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    initialBalance: r.initial_balance,
    groupId: r.group_id,
    description: r.description,
    isActive: r.is_active === 1,
    accountType: r.account_type,
    color: r.color,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
