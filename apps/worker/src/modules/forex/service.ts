import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";
import { findMissingParent } from "../../shared/parent-check";
import type {
  PushForexAccountPayload,
  PushForexPurchasePayload,
  PushForexSalePayload,
  CreateForexPurchasePayload,
  SellForexPayload,
} from "./schema";

async function getAccountType(env: Env, accountId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT account_type FROM accounts WHERE id = ?1 AND deleted_at IS NULL")
    .bind(accountId)
    .first<{ account_type: string }>();
  return row?.account_type ?? null;
}

// Port dari apps/desktop/src/shared/forex/forex-holding-math.ts. Beda dari desktop: Worker soft-delete,
// jadi semua query menyaring deleted_at IS NULL.
//
// Average cost atas POSISI TERSISA = (modal beli − modal yang dilepas lewat jual) / sisa unit. Jangan
// disalin dari investments/service.ts (rata-rata atas semua pembelian): rumus itu bergeser setelah jual
// lalu beli lagi di kurs berbeda dan jual semua menyisakan balance.
export async function getForexAverageCostPerUnit(env: Env, accountId: string): Promise<number> {
  const [purchases, sales] = await Promise.all([
    env.DB.prepare(
      "SELECT SUM(unit * rate) AS cost, SUM(unit) AS unit FROM forex_purchases WHERE account_id = ?1 AND deleted_at IS NULL"
    )
      .bind(accountId)
      .first<{ cost: number | null; unit: number | null }>(),
    env.DB.prepare(
      "SELECT SUM(unit * average_cost_per_unit) AS cost, SUM(unit) AS unit FROM forex_sales WHERE account_id = ?1 AND deleted_at IS NULL"
    )
      .bind(accountId)
      .first<{ cost: number | null; unit: number | null }>(),
  ]);

  const remainingUnit = (purchases?.unit ?? 0) - (sales?.unit ?? 0);
  if (!(remainingUnit > 0)) return 0;
  return ((purchases?.cost ?? 0) - (sales?.cost ?? 0)) / remainingUnit;
}

export async function getForexRemainingUnit(env: Env, accountId: string): Promise<number> {
  const [purchases, sales] = await Promise.all([
    env.DB.prepare("SELECT SUM(unit) AS unit FROM forex_purchases WHERE account_id = ?1 AND deleted_at IS NULL")
      .bind(accountId)
      .first<{ unit: number | null }>(),
    env.DB.prepare("SELECT SUM(unit) AS unit FROM forex_sales WHERE account_id = ?1 AND deleted_at IS NULL")
      .bind(accountId)
      .first<{ unit: number | null }>(),
  ]);
  return (purchases?.unit ?? 0) - (sales?.unit ?? 0);
}

export type PushResult = { status: "ok"; id: string } | { status: "stale" } | { status: "rejected"; reason: string };
export type DeletePushedResult = { status: "ok" } | { status: "not_found" };

// Upsert-by-id murni untuk forex_accounts (pola pushInvestmentAccountFromPc).
export async function pushForexAccountFromPc(
  env: Env,
  payload: PushForexAccountPayload,
  syncSource: SyncSource
): Promise<PushResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM forex_accounts WHERE account_id = ?1")
    .bind(payload.accountId)
    .first<{ updated_at: string | null }>();

  const decision = decideLww(resolveIncomingUpdatedAt(payload.updatedAt), existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const missingParent = await findMissingParent(env, [{ table: "accounts", id: payload.accountId, label: "Akun" }]);
  if (missingParent) return { status: "rejected", reason: missingParent };

  if (existing) {
    await env.DB.prepare(
      `UPDATE forex_accounts
       SET country = ?1, currency = ?2, current_rate = ?3, updated_at = ?4, deleted_at = NULL
       WHERE account_id = ?5`
    )
      .bind(payload.country, payload.currency, payload.currentRate, decision.updatedAt, payload.accountId)
      .run();
    return { status: "ok", id: payload.accountId };
  }

  await env.DB.prepare(
    `INSERT INTO forex_accounts (account_id, country, currency, current_rate, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(payload.accountId, payload.country, payload.currency, payload.currentRate, nowText(), decision.updatedAt, syncSource)
    .run();
  return { status: "ok", id: payload.accountId };
}

// Upsert-by-id murni untuk forex_purchases (pola pushInvestmentPurchaseFromPc).
export async function pushForexPurchaseFromPc(
  env: Env,
  payload: PushForexPurchasePayload,
  syncSource: SyncSource
): Promise<PushResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM forex_purchases WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const decision = decideLww(resolveIncomingUpdatedAt(payload.updatedAt), existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const missingParent = await findMissingParent(env, [
    { table: "accounts", id: payload.accountId, label: "Akun" },
    { table: "transactions", id: payload.transactionId, label: "Transaksi" },
  ]);
  if (missingParent) return { status: "rejected", reason: missingParent };

  if (existing) {
    await env.DB.prepare(
      `UPDATE forex_purchases
       SET account_id = ?1, transaction_id = ?2, unit = ?3, rate = ?4, date = ?5, updated_at = ?6, deleted_at = NULL
       WHERE id = ?7`
    )
      .bind(payload.accountId, payload.transactionId, payload.unit, payload.rate, payload.date, decision.updatedAt, payload.id)
      .run();
    return { status: "ok", id: payload.id };
  }

  await env.DB.prepare(
    `INSERT INTO forex_purchases (id, account_id, transaction_id, unit, rate, date, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  )
    .bind(payload.id, payload.accountId, payload.transactionId, payload.unit, payload.rate, payload.date, nowText(), decision.updatedAt, syncSource)
    .run();
  return { status: "ok", id: payload.id };
}

// Soft-delete untuk baris yang klien hapus lokal (hapus transaksi dari daftar). Tanpa ini baris lama
// menumpuk di D1 karena endpoint push hanya upsert-by-id.
export async function deletePushedForexPurchase(env: Env, id: string): Promise<DeletePushedResult> {
  const existing = await env.DB.prepare("SELECT id FROM forex_purchases WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = nowText();
  await env.DB.prepare("UPDATE forex_purchases SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}

// Upsert-by-id murni untuk forex_sales (pola pushInvestmentSaleFromPc, tanpa status).
export async function pushForexSaleFromPc(
  env: Env,
  payload: PushForexSalePayload,
  syncSource: SyncSource
): Promise<PushResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM forex_sales WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const decision = decideLww(resolveIncomingUpdatedAt(payload.updatedAt), existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const missingParent = await findMissingParent(env, [
    { table: "accounts", id: payload.accountId, label: "Akun" },
    { table: "transactions", id: payload.transactionId, label: "Transaksi" },
    { table: "transactions", id: payload.adjustmentTransactionId, label: "Transaksi penyesuaian" },
  ]);
  if (missingParent) return { status: "rejected", reason: missingParent };

  if (existing) {
    await env.DB.prepare(
      `UPDATE forex_sales
       SET account_id = ?1, transaction_id = ?2, adjustment_transaction_id = ?3, unit = ?4, rate = ?5,
           average_cost_per_unit = ?6, realized_pl = ?7, date = ?8, updated_at = ?9, deleted_at = NULL
       WHERE id = ?10`
    )
      .bind(
        payload.accountId,
        payload.transactionId,
        payload.adjustmentTransactionId,
        payload.unit,
        payload.rate,
        payload.averageCostPerUnit,
        payload.realizedPl,
        payload.date,
        decision.updatedAt,
        payload.id
      )
      .run();
    return { status: "ok", id: payload.id };
  }

  await env.DB.prepare(
    `INSERT INTO forex_sales
       (id, account_id, transaction_id, adjustment_transaction_id, unit, rate, average_cost_per_unit,
        realized_pl, date, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
  )
    .bind(
      payload.id,
      payload.accountId,
      payload.transactionId,
      payload.adjustmentTransactionId,
      payload.unit,
      payload.rate,
      payload.averageCostPerUnit,
      payload.realizedPl,
      payload.date,
      nowText(),
      decision.updatedAt,
      syncSource
    )
    .run();
  return { status: "ok", id: payload.id };
}

export async function deletePushedForexSale(env: Env, id: string): Promise<DeletePushedResult> {
  const existing = await env.DB.prepare("SELECT id FROM forex_sales WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = nowText();
  await env.DB.prepare("UPDATE forex_sales SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}

// Transaksi yang menyentuh akun valas dari sumber selain 'pc' ditolak: klien non-PC (mis. MCP) tidak punya
// jalur tulis lokal yang membuat baris forex_purchases/forex_sales, jadi transfer biasa akan jatuh jadi
// transfer kas tanpa riwayat unit. Mereka wajib memakai POST /forex/purchases dan /forex/sales. Transaksi
// dari 'pc' (desktop/mobile) lolos karena riwayatnya di-push sendiri lewat endpoint /forex/*/push.
export type ForexTransactionGuardResult = { status: "ok" } | { status: "rejected"; reason: string };

export async function validateForexTransactionAllowed(
  env: Env,
  params: { accountId: string | null; transferAccountId: string | null; syncSource: SyncSource }
): Promise<ForexTransactionGuardResult> {
  if (params.syncSource === "pc") return { status: "ok" };

  for (const accountId of [params.accountId, params.transferAccountId]) {
    if (!accountId) continue;
    if ((await getAccountType(env, accountId)) === "forex") {
      return {
        status: "rejected",
        reason:
          "Transaksi pada akun Valas tidak bisa dibuat lewat /transactions dari sumber ini. Gunakan POST /forex/purchases untuk beli atau POST /forex/sales untuk jual.",
      };
    }
  }
  return { status: "ok" };
}

// Toleransi untuk noise floating point pada unit berdesimal.
const UNIT_EPSILON = 1e-9;

// Port dari apps/desktop/src/shared/forex/assert-forex-purchase-deletable.ts. Dipanggil SEBELUM hapus
// transaksi: kalau transaksi ini pembelian valas dan menghapusnya membuat sisa unit akun negatif (unitnya
// sudah terpakai penjualan), hapus ditolak. Menghapus penjualan atau pembelian yang unitnya belum terpakai
// selalu lolos.
export async function validateForexPurchaseDeletable(
  env: Env,
  transactionId: string
): Promise<ForexTransactionGuardResult> {
  const { results: purchases } = await env.DB.prepare(
    "SELECT account_id, unit FROM forex_purchases WHERE transaction_id = ?1 AND deleted_at IS NULL"
  )
    .bind(transactionId)
    .all<{ account_id: string; unit: number }>();

  const unitByAccount = new Map<string, number>();
  for (const purchase of purchases) {
    unitByAccount.set(purchase.account_id, (unitByAccount.get(purchase.account_id) ?? 0) + purchase.unit);
  }

  for (const [accountId, removedUnit] of unitByAccount) {
    const remainingAfterDelete = (await getForexRemainingUnit(env, accountId)) - removedUnit;
    if (remainingAfterDelete < -UNIT_EPSILON) {
      return {
        status: "rejected",
        reason:
          `Pembelian valas ini tidak bisa dihapus karena unitnya sudah terpakai penjualan ` +
          `(sisa unit akan menjadi ${remainingAfterDelete}). Hapus penjualannya dulu.`,
      };
    }
  }
  return { status: "ok" };
}

export type CreateForexPurchaseResult =
  | { status: "ok"; id: string; transactionId: string }
  | { status: "rejected"; reason: string };

// Port dari apps/desktop/src/shared/forex/create-forex-purchase.ts. Nominal transaksi = unit × kurs,
// supaya modal (accounts.balance) selalu cocok dengan riwayat beli.
export async function createForexPurchase(
  env: Env,
  payload: CreateForexPurchasePayload,
  syncSource: SyncSource
): Promise<CreateForexPurchaseResult> {
  if (!(payload.unit > 0)) return { status: "rejected", reason: "Jumlah unit harus lebih dari 0." };
  if (!(payload.rate > 0)) return { status: "rejected", reason: "Kurs harus lebih dari 0." };

  // Idempotensi: id yang sama dikirim ulang (timeout, retry) mengembalikan hasil lama.
  const existing = await env.DB.prepare(
    "SELECT transaction_id FROM forex_purchases WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(payload.id)
    .first<{ transaction_id: string | null }>();
  if (existing?.transaction_id) {
    return { status: "ok", id: payload.id, transactionId: existing.transaction_id };
  }

  const forexType = await getAccountType(env, payload.forexAccountId);
  if (forexType == null) return { status: "rejected", reason: "Akun valas tidak ditemukan." };
  if (forexType !== "forex") {
    return { status: "rejected", reason: "Akun tujuan pembelian harus bertipe 'forex'." };
  }
  if (payload.cashAccountId != null) {
    const cashType = await getAccountType(env, payload.cashAccountId);
    if (cashType == null) return { status: "rejected", reason: "Akun kas tidak ditemukan." };
    if (cashType !== "cash") return { status: "rejected", reason: "Akun sumber pembelian harus bertipe 'cash'." };
  }

  const now = nowText();
  const transactionId = uuidv7();
  const amount = payload.unit * payload.rate;
  const note = payload.note ?? "Beli valas";

  if (payload.cashAccountId == null) {
    await env.DB.prepare(
      `INSERT INTO transactions
         (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
          created_at, updated_at, sync_source)
       VALUES (?1, 'income', ?2, NULL, ?3, NULL, ?4, ?5, NULL, ?6, ?6, ?7)`
    )
      .bind(transactionId, amount, payload.forexAccountId, note, payload.date, now, syncSource)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO transactions
         (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
          created_at, updated_at, sync_source)
       VALUES (?1, 'transfer', ?2, NULL, ?3, ?4, ?5, ?6, NULL, ?7, ?7, ?8)`
    )
      .bind(transactionId, amount, payload.cashAccountId, payload.forexAccountId, note, payload.date, now, syncSource)
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO forex_purchases (id, account_id, transaction_id, unit, rate, date, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)`
  )
    .bind(payload.id, payload.forexAccountId, transactionId, payload.unit, payload.rate, payload.date, now, syncSource)
    .run();

  return { status: "ok", id: payload.id, transactionId };
}

export type SellForexResult =
  | { status: "ok"; id: string; transactionId: string; adjustmentTransactionId: string | null; realizedPl: number }
  | { status: "rejected"; reason: string };

// Selisih di bawah ini dianggap nol (noise floating point), tidak membuat transaksi penyesuaian.
const PL_EPSILON = 0.005;

// Port dari apps/desktop/src/shared/forex/sell-forex.ts: dua transaksi (transfer valas -> kas senilai
// average cost × unit, plus income/expense selisih kurs di akun kas), validasi oversell.
export async function sellForex(env: Env, payload: SellForexPayload, syncSource: SyncSource): Promise<SellForexResult> {
  if (!(payload.unit > 0)) return { status: "rejected", reason: "Jumlah unit harus lebih dari 0." };
  if (!(payload.rate > 0)) return { status: "rejected", reason: "Kurs harus lebih dari 0." };

  const existing = await env.DB.prepare(
    "SELECT transaction_id, adjustment_transaction_id, realized_pl FROM forex_sales WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(payload.id)
    .first<{ transaction_id: string | null; adjustment_transaction_id: string | null; realized_pl: number }>();
  if (existing?.transaction_id) {
    return {
      status: "ok",
      id: payload.id,
      transactionId: existing.transaction_id,
      adjustmentTransactionId: existing.adjustment_transaction_id,
      realizedPl: existing.realized_pl,
    };
  }

  const forexType = await getAccountType(env, payload.forexAccountId);
  if (forexType == null) return { status: "rejected", reason: "Akun valas tidak ditemukan." };
  if (forexType !== "forex") return { status: "rejected", reason: "Akun sumber penjualan harus bertipe 'forex'." };
  const cashType = await getAccountType(env, payload.cashAccountId);
  if (cashType == null) return { status: "rejected", reason: "Akun kas tidak ditemukan." };
  if (cashType !== "cash") return { status: "rejected", reason: "Akun tujuan penjualan harus bertipe 'cash'." };

  const remainingUnit = await getForexRemainingUnit(env, payload.forexAccountId);
  if (payload.unit > remainingUnit) {
    return {
      status: "rejected",
      reason: `Unit yang dijual (${payload.unit}) melebihi sisa unit yang dimiliki (${remainingUnit}).`,
    };
  }

  const averageCost = await getForexAverageCostPerUnit(env, payload.forexAccountId);
  const realizedPl = (payload.rate - averageCost) * payload.unit;
  const now = nowText();
  const note = payload.note ?? "Jual valas";

  const transactionId = uuidv7();
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
        created_at, updated_at, sync_source)
     VALUES (?1, 'transfer', ?2, NULL, ?3, ?4, ?5, ?6, NULL, ?7, ?7, ?8)`
  )
    .bind(transactionId, averageCost * payload.unit, payload.forexAccountId, payload.cashAccountId, note, payload.date, now, syncSource)
    .run();

  let adjustmentTransactionId: string | null = null;
  if (Math.abs(realizedPl) >= PL_EPSILON) {
    adjustmentTransactionId = uuidv7();
    await env.DB.prepare(
      `INSERT INTO transactions
         (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
          created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, NULL, ?4, NULL, ?5, ?6, NULL, ?7, ?7, ?8)`
    )
      .bind(
        adjustmentTransactionId,
        realizedPl > 0 ? "income" : "expense",
        Math.abs(realizedPl),
        payload.cashAccountId,
        "Realized P/L penjualan valas",
        payload.date,
        now,
        syncSource
      )
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO forex_sales
       (id, account_id, transaction_id, adjustment_transaction_id, unit, rate, average_cost_per_unit,
        realized_pl, date, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11)`
  )
    .bind(
      payload.id,
      payload.forexAccountId,
      transactionId,
      adjustmentTransactionId,
      payload.unit,
      payload.rate,
      averageCost,
      realizedPl,
      payload.date,
      now,
      syncSource
    )
    .run();

  return { status: "ok", id: payload.id, transactionId, adjustmentTransactionId, realizedPl };
}

// Dipanggil dari deleteTransaction (tanpa guard syncSource, soft-delete turunan murni). Riwayat beli/jual
// valas tidak bermakna tanpa transaksi asalnya. Dua transaksi sebuah penjualan saling bergantung: menghapus
// salah satunya menghapus pasangannya juga (pola sama desktop detachForexForDeletedTransaction).
export async function detachForexForDeletedTransaction(env: Env, transactionId: string): Promise<void> {
  const now = nowText();

  await env.DB.prepare(
    "UPDATE forex_purchases SET deleted_at = ?1, updated_at = ?1 WHERE transaction_id = ?2 AND deleted_at IS NULL"
  )
    .bind(now, transactionId)
    .run();

  const { results: sales } = await env.DB.prepare(
    `SELECT id, transaction_id, adjustment_transaction_id FROM forex_sales
     WHERE (transaction_id = ?1 OR adjustment_transaction_id = ?1) AND deleted_at IS NULL`
  )
    .bind(transactionId)
    .all<{ id: string; transaction_id: string | null; adjustment_transaction_id: string | null }>();

  for (const sale of sales) {
    await env.DB.prepare("UPDATE forex_sales SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
      .bind(now, sale.id)
      .run();
    for (const otherId of [sale.transaction_id, sale.adjustment_transaction_id]) {
      if (otherId == null || otherId === transactionId) continue;
      await env.DB.prepare("UPDATE transactions SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL")
        .bind(now, otherId)
        .run();
    }
  }
}
