import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import {
  isCreateDirectDebtPayload,
  isCreateNonCashPaymentPayload,
  isPushDebtPayload,
  isPushDebtPaymentPayload,
} from "./schema";
import {
  createDirectDebt,
  createNonCashPayment,
  writeOffDebt,
  pushDebtFromPc,
  pushDebtPaymentFromPc,
  deletePushedDebt,
  deletePushedDebtPayment,
} from "./service";

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

// Upsert-by-id MURNI utk baris debts yg desktop sudah buat sendiri
// (apply-debt-transaction.ts lokal) -- BUKAN reuse handlePostDebt,
// lihat docs/todos/plan/fix-debts-duplikasi-sync.md.
export async function handlePostDebtPush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushDebtPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await pushDebtFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handlePostDebtPaymentPush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushDebtPaymentPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await pushDebtPaymentFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

// Soft-delete baris debts/debt_payments yg PC hapus lokal sbg bagian
// dari RECREATE (edit field berbahaya) -- lihat deletePushedDebt di
// service.ts utk kenapa ini perlu, TERPISAH dari DELETE /transactions/:id
// (detachDebtForDeletedTransaction, beda skenario).
export async function handleDeleteDebtPush(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing debt id" }, 400);

  const result = await deletePushedDebt(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Debt not found" }, 404);
  }
  return c.json({ status: "ok", id });
}

export async function handleDeleteDebtPaymentPush(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing debt payment id" }, 400);

  const result = await deletePushedDebtPayment(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Debt payment not found" }, 404);
  }
  return c.json({ status: "ok", id });
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
