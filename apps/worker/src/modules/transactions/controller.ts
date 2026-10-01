import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isPushTransactionPayload, isPatchTransactionPayload } from "./schema";
import { insertTransaction, updateTransaction } from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts.
export async function handlePostTransaction(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushTransactionPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await insertTransaction(c.env, body);

  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  if (result.status === "ignored") {
    return c.json({ status: "ignored", id: body.id });
  }

  return c.json({ status: "ok", id: body.id }, 201);
}

export async function handlePatchTransaction(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Missing transaction id" }, 400);
  }
  const body = await c.req.json().catch(() => null);
  if (!isPatchTransactionPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await updateTransaction(c.env, id, body);

  if (result.status === "not_found") {
    return c.json({ error: "Transaction not found" }, 404);
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  if (result.status === "ignored") {
    return c.json({ status: "ignored", id });
  }

  return c.json({ status: "ok", id }, 200);
}
