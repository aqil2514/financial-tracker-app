import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isCorrectAccountBalancePayload } from "./schema";
import { correctAccountBalance, getAccountBalance } from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts.
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
