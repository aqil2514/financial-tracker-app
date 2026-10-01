import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { CategoryPayload } from "./schema";

export type UpdateCategoryResult = { status: "ok" } | { status: "not_found" };

// Port dari use-create-category.ts. Default: type='expense' (SAMA dgn
// desktop, cuma dipakai kalau caller tidak kirim type -- schema MEWAJIBKAN
// type dikirim, beda dari form desktop yg py default value sendiri; TIDAK
// ADA validasi parent.type === type, lihat catatan di schema.ts.
export async function createCategory(env: Env, payload: CategoryPayload): Promise<{ id: string }> {
  const id = uuidv7();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    `INSERT INTO categories
       (id, name, icon, type, parent_id, is_active, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, 'mcp')`
  )
    .bind(
      id,
      payload.name,
      payload.icon ?? null,
      payload.type,
      payload.parentId ?? null,
      payload.isActive === false ? 0 : 1,
      now
    )
    .run();
  return { id };
}

// Port dari use-update-category.ts.
export async function updateCategory(
  env: Env,
  id: string,
  payload: CategoryPayload
): Promise<UpdateCategoryResult> {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const result = await env.DB.prepare(
    `UPDATE categories
     SET name = ?1, icon = ?2, type = ?3, parent_id = ?4, is_active = ?5, updated_at = ?6
     WHERE id = ?7 AND deleted_at IS NULL`
  )
    .bind(
      payload.name,
      payload.icon ?? null,
      payload.type,
      payload.parentId ?? null,
      payload.isActive === false ? 0 : 1,
      now,
      id
    )
    .run();
  if (result.meta.changes === 0) return { status: "not_found" };
  return { status: "ok" };
}
