import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";
import type { LabelPayload, AttachLabelPayload, EntityScope } from "./schema";

// Nama junction table + kolom FK per EntityScope -- satu-satunya tempat
// yg tahu pemetaan ini, SEMUA fungsi attach/detach/list di bawah generik
// lewat tabel ini (BUKAN 3 fungsi nyaris kembar per scope). Nama tabel
// literal (bukan dibentuk dari string scope) supaya tidak ada jalur SQL
// injection lewat parameter scope -- scope SUDAH divalidasi isEntityScope
// di schema.ts sebelum sampai sini, tapi whitelist literal ini jadi
// lapis kedua yg tidak bergantung pada validasi di layer atas.
const JUNCTION: Record<EntityScope, { table: string; column: string }> = {
  transactions: { table: "transaction_labels", column: "transaction_id" },
  categories: { table: "category_labels", column: "category_id" },
  accounts: { table: "account_labels", column: "account_id" },
};

export type UpsertLabelResult = { status: "ok"; id: string } | { status: "stale" };

// UPSERT dgn LWW, pola PERSIS account-groups/service.ts upsertAccountGroup
// -- entity paling sederhana di sini (cuma name+scope), scope TIDAK bisa
// diubah lewat update (rename label tidak boleh pindah dictionary) --
// payload.scope dari PATCH tetap wajib dikirim & harus valid, tapi kalau
// beda dari row existing, request DITOLAK di controller (lihat
// handlePatchLabel) BUKAN di sini -- service ini hanya peduli LWW.
export async function upsertLabel(
  env: Env,
  payload: LabelPayload,
  syncSource: SyncSource
): Promise<UpsertLabelResult> {
  const existing = await env.DB.prepare("SELECT updated_at, scope FROM labels WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null; scope: string }>();

  if (existing && existing.scope !== payload.scope) {
    // Scope existing menang -- rename TIDAK BOLEH memindahkan dictionary,
    // caller yg kirim scope beda dianggap bug di sisi caller.
    return { status: "stale" };
  }

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  if (!existing) {
    const now = nowText();
    await env.DB.prepare(
      "INSERT INTO labels (id, name, scope, created_at, updated_at, sync_source) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
      .bind(payload.id, payload.name, payload.scope, now, decision.updatedAt, syncSource)
      .run();
  } else {
    await env.DB.prepare("UPDATE labels SET name = ?1, updated_at = ?2, deleted_at = NULL WHERE id = ?3")
      .bind(payload.name, decision.updatedAt, payload.id)
      .run();
  }

  return { status: "ok", id: payload.id };
}

export type LabelListItem = {
  id: string;
  name: string;
  scope: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

// List dictionary, filter opsional by scope -- dipakai tool MCP
// list_labels (cek dulu label apa saja yg valid sebelum attach, pola
// sama list_attachments dicek sebelum upload_attachment).
export async function listLabels(env: Env, scope: string | null): Promise<LabelListItem[]> {
  const query = scope
    ? "SELECT id, name, scope, updated_at, deleted_at FROM labels WHERE scope = ?1 AND deleted_at IS NULL ORDER BY name"
    : "SELECT id, name, scope, updated_at, deleted_at FROM labels WHERE deleted_at IS NULL ORDER BY name";
  const result = scope
    ? await env.DB.prepare(query).bind(scope).all<LabelListItem>()
    : await env.DB.prepare(query).all<LabelListItem>();
  return result.results;
}

export type DeleteLabelResult = { status: "ok" } | { status: "not_found" };

// Soft-delete label dari dictionary. TIDAK cascade manual ke junction
// table di sini -- FK `ON DELETE CASCADE` di skema hanya jalan utk
// HARD delete (soft-delete D1 tidak trigger FK, sama catatan di
// attachments/service.ts) jadi baris junction yg masih menyebut label
// ini TETAP ada (menunjuk label yg sudah soft-deleted). Ini SENGAJA
// dibiarkan baca sbg "label berstatus terhapus" di query resolusi,
// BUKAN dibersihkan otomatis -- controller caller (desktop) yg
// memutuskan kapan hard-cleanup, selaras pola account_groups
// (hapus grup tidak otomatis bersihkan accounts.group_id di D1).
export async function deleteLabel(env: Env, id: string): Promise<DeleteLabelResult> {
  const existing = await env.DB.prepare("SELECT id FROM labels WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = nowText();
  await env.DB.prepare("UPDATE labels SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2").bind(now, id).run();
  return { status: "ok" };
}

export type AttachLabelResult = { status: "ok"; id: string } | { status: "stale" } | { status: "not_found" };

// Attach generik lintas 3 junction table lewat JUNCTION[scope] --
// pola UPSERT+LWW sama dgn upsertLabel/upsertAccountGroup, "re-attach"
// label yg sudah di-detach (deleted_at ter-isi) dianggap UPDATE biasa
// (clear deleted_at), BUKAN duplikat baru -- row junction diidentifikasi
// oleh UNIQUE(entityId, labelId), bukan oleh `id` payload semata (`id`
// cuma penting SEKALI saat baris itu pertama dibuat, lintas device
// harus sepakat `id` yg sama utk pasangan entity+label yg sama).
export async function attachLabel(
  env: Env,
  scope: EntityScope,
  entityId: string,
  payload: AttachLabelPayload,
  syncSource: SyncSource
): Promise<AttachLabelResult> {
  const { table, column } = JUNCTION[scope];

  const entityExists = await env.DB.prepare(`SELECT id FROM ${scope} WHERE id = ?1`).bind(entityId).first();
  if (!entityExists) return { status: "not_found" };
  const labelExists = await env.DB.prepare("SELECT id FROM labels WHERE id = ?1 AND deleted_at IS NULL")
    .bind(payload.labelId)
    .first();
  if (!labelExists) return { status: "not_found" };

  const existing = await env.DB.prepare(
    `SELECT id, updated_at FROM ${table} WHERE ${column} = ?1 AND label_id = ?2`
  )
    .bind(entityId, payload.labelId)
    .first<{ id: string; updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  if (!existing) {
    const now = nowText();
    await env.DB.prepare(
      `INSERT INTO ${table} (id, ${column}, label_id, created_at, updated_at, sync_source) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
      .bind(payload.id, entityId, payload.labelId, now, decision.updatedAt, syncSource)
      .run();
    return { status: "ok", id: payload.id };
  }

  await env.DB.prepare(`UPDATE ${table} SET updated_at = ?1, deleted_at = NULL WHERE id = ?2`)
    .bind(decision.updatedAt, existing.id)
    .run();
  return { status: "ok", id: existing.id };
}

export type DetachLabelResult = { status: "ok" } | { status: "not_found" };

// Detach = soft-delete row junction (UPDATE deleted_at), BUKAN DELETE
// fisik -- device lain yg belum sync harus tahu label ini SUDAH
// dicopot lewat LWW pull, DELETE fisik tidak kebawa (lihat catatan di
// "Draf skema" general-label.md).
export async function detachLabel(
  env: Env,
  scope: EntityScope,
  entityId: string,
  labelId: string
): Promise<DetachLabelResult> {
  const { table, column } = JUNCTION[scope];

  const existing = await env.DB.prepare(
    `SELECT id FROM ${table} WHERE ${column} = ?1 AND label_id = ?2 AND deleted_at IS NULL`
  )
    .bind(entityId, labelId)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = nowText();
  await env.DB.prepare(`UPDATE ${table} SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2`)
    .bind(now, existing.id)
    .run();
  return { status: "ok" };
}

export type EntityLabelItem = { labelId: string; name: string; scope: string };

// Label apa yg nempel di 1 baris tertentu -- dipakai tool MCP
// list_entity_labels DAN (nanti) query helper "resolusi nilai efektif"
// di sisi desktop. JOIN ke labels supaya langsung dapat `name`, bukan
// cuma labelId mentah -- label yg sudah soft-deleted dari dictionary
// (labels.deleted_at terisi) TETAP dikecualikan di sini walau baris
// junction-nya sendiri belum detach (lihat catatan deleteLabel).
export async function listEntityLabels(
  env: Env,
  scope: EntityScope,
  entityId: string
): Promise<EntityLabelItem[]> {
  const { table, column } = JUNCTION[scope];
  const result = await env.DB.prepare(
    `SELECT l.id as labelId, l.name as name, l.scope as scope
     FROM ${table} j
     JOIN labels l ON l.id = j.label_id
     WHERE j.${column} = ?1 AND j.deleted_at IS NULL AND l.deleted_at IS NULL
     ORDER BY l.name`
  )
    .bind(entityId)
    .all<EntityLabelItem>();
  return result.results;
}
