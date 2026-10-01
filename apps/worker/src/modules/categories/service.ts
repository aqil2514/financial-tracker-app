import type { Env } from "../../shared/env";
import type { CategoryPayload, DeleteCategoryPayload } from "./schema";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";

export type UpsertCategoryResult = { status: "ok"; id: string } | { status: "stale" };
export type DeleteCategoryResult = { status: "ok" } | { status: "not_found" };

// UPSERT dgn LWW, port dari use-create-category.ts +
// use-update-category.ts digabung (lihat shared/lww.ts). TIDAK ADA
// validasi parent.type === type, lihat catatan di schema.ts.
export async function upsertCategory(env: Env, payload: CategoryPayload): Promise<UpsertCategoryResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM categories WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  if (!existing) {
    const now = nowText();
    await env.DB.prepare(
      `INSERT INTO categories
         (id, name, icon, type, parent_id, is_active, created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'mcp')`
    )
      .bind(
        payload.id,
        payload.name,
        payload.icon ?? null,
        payload.type,
        payload.parentId ?? null,
        payload.isActive === false ? 0 : 1,
        now,
        decision.updatedAt
      )
      .run();
  } else {
    // LWW menang CLEAR deleted_at juga, lihat account-groups/service.ts.
    await env.DB.prepare(
      `UPDATE categories
       SET name = ?1, icon = ?2, type = ?3, parent_id = ?4, is_active = ?5, updated_at = ?6, deleted_at = NULL
       WHERE id = ?7`
    )
      .bind(
        payload.name,
        payload.icon ?? null,
        payload.type,
        payload.parentId ?? null,
        payload.isActive === false ? 0 : 1,
        decision.updatedAt,
        payload.id
      )
      .run();
  }

  return { status: "ok", id: payload.id };
}

// Port dari use-delete-category.ts, soft delete versi Worker (lihat
// catatan soft-delete di account-groups/service.ts). DUA relasi
// ditangani independen, PERSIS urutan desktop: sub-kategori dulu, baru
// transaksi, baru soft-delete kategori itu sendiri.
export async function deleteCategory(
  env: Env,
  id: string,
  payload: DeleteCategoryPayload
): Promise<DeleteCategoryResult> {
  const existing = await env.DB.prepare("SELECT id FROM categories WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (payload.childAction === "unassign") {
    await env.DB.prepare("UPDATE categories SET parent_id = NULL, updated_at = ?1 WHERE parent_id = ?2")
      .bind(now, id)
      .run();
  } else if (payload.childAction === "reassign" && payload.targetParentId != null) {
    await env.DB.prepare("UPDATE categories SET parent_id = ?1, updated_at = ?2 WHERE parent_id = ?3")
      .bind(payload.targetParentId, now, id)
      .run();
  }

  if (payload.transactionAction === "unassign") {
    await env.DB.prepare("UPDATE transactions SET category_id = NULL, updated_at = ?1 WHERE category_id = ?2")
      .bind(now, id)
      .run();
  } else if (payload.transactionAction === "reassign" && payload.targetCategoryId != null) {
    await env.DB.prepare("UPDATE transactions SET category_id = ?1, updated_at = ?2 WHERE category_id = ?3")
      .bind(payload.targetCategoryId, now, id)
      .run();
  }

  await env.DB.prepare("UPDATE categories SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}
