import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { AccountGroupPayload, DeleteAccountGroupPayload } from "./schema";

export type UpdateAccountGroupResult = { status: "ok" } | { status: "not_found" };
export type DeleteAccountGroupResult = { status: "ok" } | { status: "not_found" };

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

// Port dari use-delete-account-group.ts (soft delete versi Worker --
// desktop hard DELETE, Worker SET deleted_at krn kolom sync). Kalau
// grup masih py anggota (accounts.group_id = id ini) DAN memberAction
// tidak dikirim, ON DELETE SET NULL skema TIDAK berlaku di soft delete
// (beda dari hard delete) -- anggota TETAP merujuk group_id yg sudah
// "dihapus". Ini SENGAJA beda dari desktop: soft delete D1 tidak bisa
// mengandalkan FK CASCADE/SET NULL krn baris induk tidak benar2 hilang.
export async function deleteAccountGroup(
  env: Env,
  id: string,
  payload: DeleteAccountGroupPayload
): Promise<DeleteAccountGroupResult> {
  const existing = await env.DB.prepare(
    "SELECT id FROM account_groups WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (payload.memberAction === "unassign") {
    await env.DB.prepare("UPDATE accounts SET group_id = NULL, updated_at = ?1 WHERE group_id = ?2")
      .bind(now, id)
      .run();
  } else if (payload.memberAction === "reassign" && payload.targetGroupId != null) {
    await env.DB.prepare("UPDATE accounts SET group_id = ?1, updated_at = ?2 WHERE group_id = ?3")
      .bind(payload.targetGroupId, now, id)
      .run();
  }

  await env.DB.prepare("UPDATE account_groups SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}
