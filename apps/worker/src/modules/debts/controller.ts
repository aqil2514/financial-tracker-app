import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import { isCreateDirectDebtPayload, isCreateNonCashPaymentPayload } from "./schema";
import { createDirectDebt, createNonCashPayment, writeOffDebt } from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts.
export async function handlePostDebt(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isCreateDirectDebtPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await createDirectDebt(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handlePostDebtPayment(c: Context<AppContext>) {
  const debtId = c.req.param("id");
  if (!debtId) return c.json({ error: "Missing debt id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!isCreateNonCashPaymentPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await createNonCashPayment(c.env, debtId, body, c.get("syncSource"));
  if (result.status === "not_found") {
    return c.json({ error: "Debt not found" }, 404);
  }
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handlePostDebtWriteOff(c: Context<AppContext>) {
  const debtId = c.req.param("id");
  if (!debtId) return c.json({ error: "Missing debt id" }, 400);

  const result = await writeOffDebt(c.env, debtId, c.get("syncSource"));
  if (result.status === "not_found") {
    return c.json({ error: "Debt not found" }, 404);
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  return c.json({ status: "ok", transactionId: result.transactionId });
}
