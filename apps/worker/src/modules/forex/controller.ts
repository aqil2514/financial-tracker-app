import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import {
  isPushForexAccountPayload,
  isPushForexPurchasePayload,
  isPushForexSalePayload,
  isCreateForexPurchasePayload,
  isSellForexPayload,
} from "./schema";
import {
  pushForexAccountFromPc,
  pushForexPurchaseFromPc,
  deletePushedForexPurchase,
  pushForexSaleFromPc,
  deletePushedForexSale,
  createForexPurchase,
  sellForex,
} from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts.
export async function handlePostForexAccountPush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushForexAccountPayload(body)) return c.json({ error: "Invalid payload" }, 400);

  const result = await pushForexAccountFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "rejected") return c.json({ error: result.reason }, 422);
  if (result.status === "stale") return c.json({ status: "ignored", id: body.accountId });
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handlePostForexPurchasePush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushForexPurchasePayload(body)) return c.json({ error: "Invalid payload" }, 400);

  const result = await pushForexPurchaseFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "rejected") return c.json({ error: result.reason }, 422);
  if (result.status === "stale") return c.json({ status: "ignored", id: body.id });
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handleDeleteForexPurchasePush(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing forex purchase id" }, 400);

  const result = await deletePushedForexPurchase(c.env, id);
  if (result.status === "not_found") return c.json({ error: "Forex purchase not found" }, 404);
  return c.json({ status: "ok", id });
}

export async function handlePostForexSalePush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushForexSalePayload(body)) return c.json({ error: "Invalid payload" }, 400);

  const result = await pushForexSaleFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "rejected") return c.json({ error: result.reason }, 422);
  if (result.status === "stale") return c.json({ status: "ignored", id: body.id });
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handleDeleteForexSalePush(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing forex sale id" }, 400);

  const result = await deletePushedForexSale(c.env, id);
  if (result.status === "not_found") return c.json({ error: "Forex sale not found" }, 404);
  return c.json({ status: "ok", id });
}

export async function handlePostForexPurchase(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isCreateForexPurchasePayload(body)) return c.json({ error: "Invalid payload" }, 400);

  const result = await createForexPurchase(c.env, body, c.get("syncSource"));
  if (result.status === "rejected") return c.json({ error: result.reason }, 422);
  return c.json({ status: "ok", id: result.id, transactionId: result.transactionId }, 201);
}

export async function handlePostForexSale(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isSellForexPayload(body)) return c.json({ error: "Invalid payload" }, 400);

  const result = await sellForex(c.env, body, c.get("syncSource"));
  if (result.status === "rejected") return c.json({ error: result.reason }, 422);
  return c.json(
    {
      status: "ok",
      id: result.id,
      transactionId: result.transactionId,
      adjustmentTransactionId: result.adjustmentTransactionId,
      realizedPl: result.realizedPl,
    },
    201
  );
}
