import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isContactPayload } from "./schema";
import { createContact, updateContact, deleteContact } from "./service";

export async function handlePostContact(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json().catch(() => null);
  if (!isContactPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const { id } = await createContact(c.env, body);
  return c.json({ status: "ok", id }, 201);
}

export async function handlePatchContact(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing contact id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!isContactPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await updateContact(c.env, id, body);
  if (result.status === "not_found") {
    return c.json({ error: "Contact not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}

export async function handleDeleteContact(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing contact id" }, 400);

  const result = await deleteContact(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Contact not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}
