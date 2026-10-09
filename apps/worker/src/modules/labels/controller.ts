import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import { isLabelPayload, isAttachLabelPayload, isEntityScope } from "./schema";
import { upsertLabel, listLabels, deleteLabel, attachLabel, detachLabel, listEntityLabels } from "./service";

export async function handlePostLabel(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isLabelPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const result = await upsertLabel(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

// PATCH /:id -- rename label. Pola sama handlePatchAccountGroup: body
// boleh tanpa `id` (diisi dari path), tapi kalau ikut kirim HARUS cocok.
export async function handlePatchLabel(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing label id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const merged = { ...(body as Record<string, unknown>), id: (body as Record<string, unknown>).id ?? id };
  if (merged.id !== id) {
    return c.json({ error: "Body id does not match path id" }, 400);
  }
  if (!isLabelPayload(merged)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await upsertLabel(c.env, merged, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id });
  }
  return c.json({ status: "ok", id: result.id }, 200);
}

export async function handleListLabels(c: Context<AppContext>) {
  const scope = c.req.query("scope") ?? null;
  const result = await listLabels(c.env, scope);
  return c.json({ labels: result }, 200);
}

export async function handleDeleteLabel(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing label id" }, 400);

  const result = await deleteLabel(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Label not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}

export async function handleAttachLabel(c: Context<AppContext>) {
  const scope = c.req.param("scope");
  const entityId = c.req.param("entityId");
  if (!isEntityScope(scope)) {
    return c.json({ error: "Invalid scope, expected transactions|categories|accounts" }, 400);
  }
  if (!entityId) return c.json({ error: "Missing entity id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!isAttachLabelPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await attachLabel(c.env, scope, entityId, body, c.get("syncSource"));
  if (result.status === "not_found") {
    return c.json({ error: "Entity or label not found" }, 404);
  }
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handleDetachLabel(c: Context<AppContext>) {
  const scope = c.req.param("scope");
  const entityId = c.req.param("entityId");
  const labelId = c.req.param("labelId");
  if (!isEntityScope(scope)) {
    return c.json({ error: "Invalid scope, expected transactions|categories|accounts" }, 400);
  }
  if (!entityId || !labelId) return c.json({ error: "Missing entity id or label id" }, 400);

  const result = await detachLabel(c.env, scope, entityId, labelId);
  if (result.status === "not_found") {
    return c.json({ error: "Attached label not found" }, 404);
  }
  return c.json({ status: "ok" }, 200);
}

export async function handleListEntityLabels(c: Context<AppContext>) {
  const scope = c.req.param("scope");
  const entityId = c.req.param("entityId");
  if (!isEntityScope(scope)) {
    return c.json({ error: "Invalid scope, expected transactions|categories|accounts" }, 400);
  }
  if (!entityId) return c.json({ error: "Missing entity id" }, 400);

  const result = await listEntityLabels(c.env, scope, entityId);
  return c.json({ labels: result }, 200);
}
