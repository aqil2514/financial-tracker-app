import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isCategoryPayload, isDeleteCategoryPayload } from "./schema";
import { upsertCategory, deleteCategory } from "./service";

export async function handlePostCategory(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json().catch(() => null);
  if (!isCategoryPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const result = await upsertCategory(c.env, body);
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handlePatchCategory(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing category id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const merged = { ...(body as Record<string, unknown>), id: (body as Record<string, unknown>).id ?? id };
  if (merged.id !== id) {
    return c.json({ error: "Body id does not match path id" }, 400);
  }
  if (!isCategoryPayload(merged)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await upsertCategory(c.env, merged);
  if (result.status === "stale") {
    return c.json({ status: "ignored", id });
  }
  return c.json({ status: "ok", id: result.id }, 200);
}

export async function handleDeleteCategory(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing category id" }, 400);

  const rawBody = await c.req.text();
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }
  if (!isDeleteCategoryPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await deleteCategory(c.env, id, body ?? {});
  if (result.status === "not_found") {
    return c.json({ error: "Category not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}
