import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import {
  isPushInvestmentAccountPayload,
  isPushInvestmentPurchasePayload,
  isPushInvestmentSalePayload,
  isSettleInvestmentSalePayload,
  isCreateDirectInvestmentPurchasePayload,
  isWriteOffInvestmentPayload,
  isCorrectInvestmentBalancePayload,
} from "./schema";
import {
  pushInvestmentAccountFromPc,
  pushInvestmentPurchaseFromPc,
  deletePushedInvestmentPurchase,
  pushInvestmentSaleFromPc,
  deletePushedInvestmentSale,
  settleInvestmentSale,
  deletePendingInvestmentSale,
  createDirectInvestmentPurchase,
  writeOffInvestment,
  correctInvestmentBalance,
  InvestmentBalanceCorrectionMismatchError,
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

// Unit bertambah TANPA transfer kas (hibah, bonus saham, right issue,
// saldo & unit awal sebelum pakai app) -- pola PERSIS handlePostDebt
// (createDirectDebt), BUKAN jalur push: Worker SENDIRI yang insert
// transaksi income + baris investment_purchases (dipanggil langsung dari
// MCP, tidak harus lewat desktop). Lihat service.ts.
export async function handlePostInvestmentPurchaseDirect(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isCreateDirectInvestmentPurchasePayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await createDirectInvestmentPurchase(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  return c.json({ status: "ok", id: result.id, transactionId: result.transactionId }, 201);
}

// Unit hilang/dilepas TANPA kas yang berpindah (hibah ke orang lain,
// delisting, biaya admin dipotong dalam bentuk unit) -- pola PERSIS
// handlePostDebtWriteOff (writeOffDebt), BUKAN jalur push. Lihat
// service.ts (writeOffInvestment).
export async function handlePostInvestmentWriteOff(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isWriteOffInvestmentPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await writeOffInvestment(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  return c.json(
    { status: "ok", id: result.id, transactionId: result.transactionId, averageCost: result.averageCost },
    201
  );
}

// Koreksi granular akun 'investment' -- BEDA dari handlePostCorrectBalance
// (accounts/controller.ts) yang menolak TOTAL akun bertipe 'investment'.
// unit DAN pricePerUnit KEDUANYA manual (BEDA dari write-off di atas yang
// pakai averageCost sistem) -- lihat service.ts (correctInvestmentBalance)
// utk detail arah beli/jual + guard rollback.
export async function handlePostInvestmentCorrectBalance(c: Context<AppContext>) {
  const accountId = c.req.param("accountId");
  if (!accountId) return c.json({ error: "Missing accountId" }, 400);

  const body = await c.req.json().catch(() => null);
  if (!isCorrectInvestmentBalancePayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  try {
    const result = await correctInvestmentBalance(c.env, accountId, body, c.get("syncSource"));
    if (result.status === "no_change") {
      return c.json({ status: "ok", message: "Unit yang diinput sama dengan sisa unit saat ini -- tidak ada yang perlu dikoreksi." });
    }
    if (result.status === "rejected") {
      return c.json({ error: result.reason }, 422);
    }
    return c.json(
      {
        status: "ok",
        transactionId: result.transactionId,
        direction: result.direction,
        diffUnit: result.diffUnit,
        investmentPurchaseId: result.investmentPurchaseId,
        investmentSaleId: result.investmentSaleId,
      },
      201
    );
  } catch (err) {
    if (err instanceof InvestmentBalanceCorrectionMismatchError) {
      return c.json({ error: err.message }, 422);
    }
    throw err;
  }
}
