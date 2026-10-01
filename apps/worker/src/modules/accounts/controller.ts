import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isCorrectAccountBalancePayload, isDeleteAccountPayload, isAccountPayload } from "./schema";
import {
  correctAccountBalance,
  getAccountBalance,
  deleteAccount,
  upsertAccount,
} from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts.
export async function handlePostAccount(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json().catch(() => null);
  if (!isAccountPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const result = await upsertAccount(c.env, body);
  if (result.status === "stale") {
    return c.json({ status: "ok", message: "Ignored: existing row is newer (LWW)" });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handlePatchAccount(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing account id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const merged = { ...(body as Record<string, unknown>), id: (body as Record<string, unknown>).id ?? id };
  if (merged.id !== id) {
    return c.json({ error: "Body id does not match path id" }, 400);
  }
  if (!isAccountPayload(merged)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await upsertAccount(c.env, merged);
  if (result.status === "stale") {
    return c.json({ status: "ok", message: "Ignored: existing row is newer (LWW)" });
  }
  return c.json({ status: "ok", id: result.id }, 200);
}

export async function handleGetAccountBalance(c: Context<{ Bindings: Env }>) {
  const accountId = c.req.query("accountId");
  if (!accountId) {
    return c.json({ error: "Missing accountId" }, 400);
  }

  const balance = await getAccountBalance(c.env, accountId);
  if (balance === null) {
    return c.json({ error: "Account not found" }, 404);
  }

  return c.json({ accountId, balance });
}

export async function handlePostCorrectBalance(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json().catch(() => null);
  if (!isCorrectAccountBalancePayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await correctAccountBalance(c.env, body.accountId, body.targetBalance);

  if (result.status === "account_not_found") {
    return c.json({ error: "Account not found" }, 404);
  }

  if (result.status === "no_change") {
    return c.json({ status: "ok", message: "Balance already matches target" });
  }

  return c.json({ status: "ok", transactionId: result.transactionId }, 201);
}

export async function handleDeleteAccount(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing account id" }, 400);

  const rawBody = await c.req.text();
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }
  if (!isDeleteAccountPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await deleteAccount(c.env, id, body ?? {});
  if (result.status === "not_found") {
    return c.json({ error: "Account not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}
