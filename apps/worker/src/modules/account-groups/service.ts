import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import type { AccountGroupPayload, DeleteAccountGroupPayload } from "./schema";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";

export type UpsertAccountGroupResult =
  | { status: "ok"; id: string }
  | { status: "stale" };
export type DeleteAccountGroupResult = { status: "ok" } | { status: "not_found" };

// UPSERT dgn LWW, port dari use-create-account-group.ts +
// use-update-account-group.ts (digabung -- lihat shared/lww.ts). `id`
// dari payload (BUKAN server-generate lagi): kalau belum ada row dgn id
// itu -> INSERT; kalau sudah ada -> bandingkan `updatedAt` masuk vs
// existing, menang kalau lebih baru, diabaikan (status "stale") kalau
// tidak. Entity paling sederhana, tidak ada validasi bisnis lain selain
// required `name`.
export async function upsertAccountGroup(
  env: Env,
  payload: AccountGroupPayload,
  syncSource: SyncSource
): Promise<UpsertAccountGroupResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM account_groups WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  if (!existing) {
    const now = nowText();
    await env.DB.prepare(
      "INSERT INTO account_groups (id, name, created_at, updated_at, sync_source) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
      .bind(payload.id, payload.name, now, decision.updatedAt, syncSource)
      .run();
  } else {
    // LWW menang CLEAR deleted_at juga -- row yg sempat soft-delete di
    // satu sisi "hidup lagi" kalau sisi lain edit dgn updatedAt lebih
    // baru (lihat keputusan di cloud-sync.md "UPSERT vs soft-deleted row").
    await env.DB.prepare(
      "UPDATE account_groups SET name = ?1, updated_at = ?2, deleted_at = NULL WHERE id = ?3"
    )
      .bind(payload.name, decision.updatedAt, payload.id)
      .run();
  }

  return { status: "ok", id: payload.id };
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
