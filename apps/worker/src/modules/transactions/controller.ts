import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isPushTransactionPayload } from "./schema";
import { insertTransaction } from "./service";

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

  return c.json({ status: "ok", id: body.id }, 201);
}
