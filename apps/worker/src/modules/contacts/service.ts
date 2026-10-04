import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import type { ContactPayload } from "./schema";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";

export type UpsertContactResult = { status: "ok"; id: string } | { status: "stale" };
export type DeleteContactResult = { status: "ok" } | { status: "not_found" };

// UPSERT dgn LWW, port dari use-create-contact.ts + use-update-contact.ts
// digabung (lihat shared/lww.ts).
export async function upsertContact(
  env: Env,
  payload: ContactPayload,
  syncSource: SyncSource
): Promise<UpsertContactResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM contacts WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  if (!existing) {
    const now = nowText();
    await env.DB.prepare(
      "INSERT INTO contacts (id, name, note, created_at, updated_at, sync_source) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
      .bind(payload.id, payload.name, payload.note ?? null, now, decision.updatedAt, syncSource)
      .run();
  } else {
    // LWW menang CLEAR deleted_at juga, lihat account-groups/service.ts.
    await env.DB.prepare(
      "UPDATE contacts SET name = ?1, note = ?2, updated_at = ?3, deleted_at = NULL WHERE id = ?4"
    )
      .bind(payload.name, payload.note ?? null, decision.updatedAt, payload.id)
      .run();
  }

  return { status: "ok", id: payload.id };
}

// Port dari use-delete-contact.ts, soft delete versi Worker (lihat
// catatan soft-delete di account-groups/service.ts). BEDA dari
// accounts/categories/account_groups: desktop TIDAK menawarkan
// reassign/unassign apa pun di sini -- langsung DELETE, FK
// `transactions.contact_id`/`debts.contact_id ON DELETE SET NULL` yg
// menangani sisanya scr implisit.
//
// CATATAN KOREKSI (2026-10-04, menutup gap yg dicatat di "Yang BELUM
// diputuskan"): versi SEBELUMNYA cuma soft-delete `contacts` TANPA
// unassign apa pun -- krn FK `ON DELETE SET NULL` HANYA terpicu kalau
// baris BENAR2 di-hard-delete, soft-delete di Worker bikin
// `transactions.contact_id`/`debts.contact_id` TETAP menunjuk ke
// kontak yg sudah `deleted_at` (TIDAK auto-NULL spt desktop). Diputuskan
// SAMAKAN perilakunya dgn desktop: UPDATE kedua kolom jadi NULL secara
// EKSPLISIT di sini, SEBELUM soft-delete `contacts` sendiri (urutan tidak
// signifikan scr data, konsisten dgn pola "resolve dulu baru commit" di
// transactions/service.ts).
export async function deleteContact(env: Env, id: string): Promise<DeleteContactResult> {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const existing = await env.DB.prepare("SELECT id FROM contacts WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  await env.DB.prepare("UPDATE transactions SET contact_id = NULL, updated_at = ?1 WHERE contact_id = ?2")
    .bind(now, id)
    .run();
  await env.DB.prepare("UPDATE debts SET contact_id = NULL, updated_at = ?1 WHERE contact_id = ?2")
    .bind(now, id)
    .run();
  await env.DB.prepare("UPDATE contacts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();

  return { status: "ok" };
}

// Logic dari mcp-server-business-logic-audit.md ("Boleh diabaikan/
// ditangani longgar"): auto-create by exact name TETAP WAJIB direplikasi
// (bukan opsional) -- port PERSIS dari resolve-contact.ts
// (resolveContactId). Get-or-create: exact match case-insensitive dulu,
// kalau tidak ada baru insert baru TANPA `note`. Dipakai dari modul LAIN
// (mis. debts manual nanti) sbg PEMICU -- contacts jadi PEMILIK logic ini,
// lihat module-structure.md "Logic bisnis lintas-modul".
export async function resolveContactId(
  env: Env,
  name: string | null,
  syncSource: SyncSource
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await env.DB.prepare(
    "SELECT id FROM contacts WHERE name = ?1 COLLATE NOCASE AND deleted_at IS NULL LIMIT 1"
  )
    .bind(trimmed)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const id = uuidv7();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    "INSERT INTO contacts (id, name, created_at, updated_at, sync_source) VALUES (?1, ?2, ?3, ?3, ?4)"
  )
    .bind(id, trimmed, now, syncSource)
    .run();
  return id;
}
