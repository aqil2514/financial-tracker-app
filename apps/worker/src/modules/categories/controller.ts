import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isCategoryPayload, isDeleteCategoryPayload } from "./schema";
import { createCategory, updateCategory, deleteCategory } from "./service";

export async function handlePostCategory(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json().catch(() => null);
  if (!isCategoryPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const { id } = await createCategory(c.env, body);
  return c.json({ status: "ok", id }, 201);
}

export async function handlePatchCategory(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing category id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!isCategoryPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await updateCategory(c.env, id, body);
  if (result.status === "not_found") {
    return c.json({ error: "Category not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
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
