import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import { isAccountGroupPayload, isDeleteAccountGroupPayload } from "./schema";
import { upsertAccountGroup, deleteAccountGroup } from "./service";

export async function handlePostAccountGroup(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isAccountGroupPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const result = await upsertAccountGroup(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

// PATCH /:id -- id dari path, SAMA semantiknya dgn POST (upsert LWW).
// Kalau body ikut kirim `id`, HARUS cocok dgn path (caller yg beda jadi
// error eksplisit, bukan diam-diam dipakai salah satu).
export async function handlePatchAccountGroup(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing account group id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const merged = { ...(body as Record<string, unknown>), id: (body as Record<string, unknown>).id ?? id };
  if (merged.id !== id) {
    return c.json({ error: "Body id does not match path id" }, 400);
  }
  if (!isAccountGroupPayload(merged)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await upsertAccountGroup(c.env, merged, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id });
  }
  return c.json({ status: "ok", id: result.id }, 200);
}

export async function handleDeleteAccountGroup(c: Context<AppContext>) {
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
