import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import { isPushInvestmentAccountPayload, isPushInvestmentPurchasePayload } from "./schema";
import { pushInvestmentAccountFromPc, pushInvestmentPurchaseFromPc, deletePushedInvestmentPurchase } from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts.
export async function handlePostInvestmentAccountPush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushInvestmentAccountPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await pushInvestmentAccountFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.accountId });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handlePostInvestmentPurchasePush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushInvestmentPurchasePayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await pushInvestmentPurchaseFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handleDeleteInvestmentPurchasePush(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing investment purchase id" }, 400);

  const result = await deletePushedInvestmentPurchase(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Investment purchase not found" }, 404);
  }
  return c.json({ status: "ok", id });
}
