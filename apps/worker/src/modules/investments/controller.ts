import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import {
  isPushInvestmentAccountPayload,
  isPushInvestmentPurchasePayload,
  isPushInvestmentSalePayload,
  isSettleInvestmentSalePayload,
} from "./schema";
import {
  pushInvestmentAccountFromPc,
  pushInvestmentPurchaseFromPc,
  deletePushedInvestmentPurchase,
  pushInvestmentSaleFromPc,
  deletePushedInvestmentSale,
  settleInvestmentSale,
  deletePendingInvestmentSale,
} from "./service";

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

export async function handlePostInvestmentSalePush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushInvestmentSalePayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await pushInvestmentSaleFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handleDeleteInvestmentSalePush(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing investment sale id" }, 400);

  const result = await deletePushedInvestmentSale(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Investment sale not found" }, 404);
  }
  return c.json({ status: "ok", id });
}

// Settle satu baris investment_sales pending -- BEDA dari endpoint push di
// atas (upsert-by-id murni): ini dipanggil dari aksi UI tombol "Settle"
// (bukan desktop yang sudah punya baris lokalnya sendiri), Worker SENDIRI
// yang insert leg transfer + leg penyesuaian P/L (pola PERSIS
// settleInvestmentSale desktop, lihat service.ts).
export async function handlePostInvestmentSaleSettle(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing investment sale id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!isSettleInvestmentSalePayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await settleInvestmentSale(c.env, id, body.transferAccountId, c.get("syncSource"));
  if (result.status === "not_found") {
    return c.json({ error: "Investment sale not found" }, 404);
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  return c.json({ status: "ok", transactionId: result.transactionId, adjustmentTransactionId: result.adjustmentTransactionId });
}

// Hapus satu baris investment_sales yang MASIH pending -- dipanggil dari
// aksi UI tombol "Hapus" (bukan endpoint push, tidak ada padanan lokal
// yang perlu disinkronkan krn baris pending TIDAK PERNAH di-push desktop
// sampai settled, lihat applySellInvestmentTransaction).
export async function handleDeleteInvestmentSale(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing investment sale id" }, 400);

  const result = await deletePendingInvestmentSale(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Investment sale not found" }, 404);
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  return c.json({ status: "ok", id });
}
