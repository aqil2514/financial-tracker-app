import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { AccountGroupPayload } from "./schema";

export type UpdateAccountGroupResult = { status: "ok" } | { status: "not_found" };

// Port PERSIS dari use-create-account-group.ts -- entity paling
// sederhana, cuma required field `name`, tidak ada validasi bisnis lain.
export async function createAccountGroup(env: Env, payload: AccountGroupPayload): Promise<{ id: string }> {
  const id = uuidv7();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    "INSERT INTO account_groups (id, name, created_at, updated_at, sync_source) VALUES (?1, ?2, ?3, ?3, 'mcp')"
  )
    .bind(id, payload.name, now)
    .run();
  return { id };
}

// Port PERSIS dari use-update-account-group.ts.
export async function updateAccountGroup(
  env: Env,
  id: string,
  payload: AccountGroupPayload
): Promise<UpdateAccountGroupResult> {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const result = await env.DB.prepare(
    "UPDATE account_groups SET name = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL"
  )
    .bind(payload.name, now, id)
    .run();
  if (result.meta.changes === 0) return { status: "not_found" };
  return { status: "ok" };
}
