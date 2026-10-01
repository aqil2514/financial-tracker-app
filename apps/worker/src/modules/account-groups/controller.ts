import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isAccountGroupPayload } from "./schema";
import { createAccountGroup, updateAccountGroup } from "./service";

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
