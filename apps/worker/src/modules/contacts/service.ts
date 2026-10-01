import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { ContactPayload } from "./schema";

export type UpdateContactResult = { status: "ok" } | { status: "not_found" };
export type DeleteContactResult = { status: "ok" } | { status: "not_found" };

export async function createContact(env: Env, payload: ContactPayload): Promise<{ id: string }> {
  const id = uuidv7();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    "INSERT INTO contacts (id, name, note, created_at, updated_at, sync_source) VALUES (?1, ?2, ?3, ?4, ?4, 'mcp')"
  )
    .bind(id, payload.name, payload.note ?? null, now)
    .run();
  return { id };
}

export async function updateContact(
  env: Env,
  id: string,
  payload: ContactPayload
): Promise<UpdateContactResult> {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const result = await env.DB.prepare(
    "UPDATE contacts SET name = ?1, note = ?2, updated_at = ?3 WHERE id = ?4 AND deleted_at IS NULL"
  )
    .bind(payload.name, payload.note ?? null, now, id)
    .run();
  if (result.meta.changes === 0) return { status: "not_found" };
  return { status: "ok" };
}

// Port dari use-delete-contact.ts, soft delete versi Worker (lihat
// catatan soft-delete di account-groups/service.ts). BEDA dari
// accounts/categories/account_groups: desktop TIDAK menawarkan
// reassign/unassign apa pun di sini -- langsung DELETE, FK
// `transactions.contact_id ON DELETE SET NULL` yg menangani sisanya
// scr implisit. Port APA ADANYA, TANPA payload action.
export async function deleteContact(env: Env, id: string): Promise<DeleteContactResult> {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const result = await env.DB.prepare(
    "UPDATE contacts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL"
  )
    .bind(now, id)
    .run();
  if (result.meta.changes === 0) return { status: "not_found" };
  return { status: "ok" };
}

// Logic dari mcp-server-business-logic-audit.md ("Boleh diabaikan/
// ditangani longgar"): auto-create by exact name TETAP WAJIB direplikasi
// (bukan opsional) -- port PERSIS dari resolve-contact.ts
// (resolveContactId). Get-or-create: exact match case-insensitive dulu,
// kalau tidak ada baru insert baru TANPA `note`. Dipakai dari modul LAIN
// (mis. debts manual nanti) sbg PEMICU -- contacts jadi PEMILIK logic ini,
// lihat module-structure.md "Logic bisnis lintas-modul".
export async function resolveContactId(env: Env, name: string | null): Promise<string | null> {
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
    "INSERT INTO contacts (id, name, created_at, updated_at, sync_source) VALUES (?1, ?2, ?3, ?3, 'mcp')"
  )
    .bind(id, trimmed, now)
    .run();
  return id;
}
