import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isAccountGroupPayload, isDeleteAccountGroupPayload } from "./schema";
import { createAccountGroup, updateAccountGroup, deleteAccountGroup } from "./service";

export async function handlePostAccountGroup(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json().catch(() => null);
  if (!isAccountGroupPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const { id } = await createAccountGroup(c.env, body);
  return c.json({ status: "ok", id }, 201);
}

export async function handlePatchAccountGroup(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing account group id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!isAccountGroupPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await updateAccountGroup(c.env, id, body);
  if (result.status === "not_found") {
    return c.json({ error: "Account group not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}

export async function handleDeleteAccountGroup(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing account group id" }, 400);

  // DELETE lazimnya tanpa body -- kalau tidak ada body sama sekali,
  // treat spt payload kosong (tidak ada action eksplisit).
  const rawBody = await c.req.text();
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }
  if (!isDeleteAccountGroupPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await deleteAccountGroup(c.env, id, body ?? {});
  if (result.status === "not_found") {
    return c.json({ error: "Account group not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}
