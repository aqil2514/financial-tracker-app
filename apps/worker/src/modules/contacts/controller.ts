import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import { isContactPayload } from "./schema";
import { upsertContact, deleteContact } from "./service";

export async function handlePostContact(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isContactPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const result = await upsertContact(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handlePatchContact(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing contact id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const merged = { ...(body as Record<string, unknown>), id: (body as Record<string, unknown>).id ?? id };
  if (merged.id !== id) {
    return c.json({ error: "Body id does not match path id" }, 400);
  }
  if (!isContactPayload(merged)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await upsertContact(c.env, merged, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id });
  }
  return c.json({ status: "ok", id: result.id }, 200);
}

export async function handleDeleteContact(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing contact id" }, 400);

  const result = await deleteContact(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Contact not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}
