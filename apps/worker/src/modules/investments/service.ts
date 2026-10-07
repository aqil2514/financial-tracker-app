import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import { classifyAccountPair } from "../debts/classify-account-pair";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";
import type { PushInvestmentAccountPayload, PushInvestmentPurchasePayload } from "./schema";

async function getAccountType(env: Env, accountId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT account_type FROM accounts WHERE id = ?1 AND deleted_at IS NULL")
    .bind(accountId)
    .first<{ account_type: string }>();
  return row?.account_type ?? null;
}

export type ApplyInvestmentTransactionInput = {
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  // Hanya terisi untuk type === 'transfer'.
  transferAccountId: string | null;
  date: string;
  // Opsional -- order yang masih diproses (mis. reksadana) sering belum
  // tahu unit pastinya sampai settlement dikonfirmasi, sama alasan
  // dgn apps/desktop/src/shared/investments/apply-investment-transaction.ts.
  unit: number | null;
  pricePerUnit: number | null;
  status?: "pending" | "settled";
  syncSource: SyncSource;
};

export type TouchedInvestmentRows = {
  investmentPurchaseIds: string[];
  deletedInvestmentPurchaseIds: string[];
};

const none: TouchedInvestmentRows = { investmentPurchaseIds: [], deletedInvestmentPurchaseIds: [] };

// Port PERSIS dari
// apps/desktop/src/shared/investments/apply-investment-transaction.ts
// (applyInvestmentTransaction) -- dipanggil dari transactions/service.ts
// SETELAH baris `transactions` tersimpan, pola sama applyDebtTransaction
// (lihat docs/todos/plan/investment-sync.md Tahap 2, PEMILIK logic ini
// adalah modul investments/, transactions/service.ts cuma PEMICU).
//
// - cash -> investment: satu baris investment_purchases baru.
// - investment -> cash (penjualan): BUKAN urusan fungsi ini -- no-op,
//   ditangani fungsi terpisah applySellInvestmentTransaction (logic jual
//   jauh lebih kompleks -- average cost, Realized P/L, validasi oversell
//   -- BELUM diport ke Worker, lihat investment-sync.md Tahap 2 lanjutan).
// - kombinasi investment lain: classifyAccountPair sudah throw
//   UnsupportedAccountPairError lebih dulu di validateAccountPairSupported
//   (debts/service.ts, dipanggil SEBELUM insert transaksi) -- tidak
//   pernah sampai ke sini.
export async function applyInvestmentTransaction(
  env: Env,
  input: ApplyInvestmentTransactionInput
): Promise<TouchedInvestmentRows> {
  const { transactionId, type, accountId, transferAccountId, date, unit, pricePerUnit, status = "pending" } = input;

  if (type !== "transfer" || transferAccountId == null) return none;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(env, accountId),
    getAccountType(env, transferAccountId),
  ]);
  if (sourceType == null || destinationType == null) return none;

  // Sudah dicegat lebih dulu oleh validateAccountPairSupported -- throw
  // di sini murni safety net, seharusnya tidak pernah tercapai.
  const pairKind = classifyAccountPair(sourceType, destinationType);
  if (pairKind !== "cash-investment") return none;

  const id = uuidv7();
  const now = nowText();
  await env.DB.prepare(
    `INSERT INTO investment_purchases
       (id, account_id, transaction_id, unit, price_per_unit, date, status, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9)`
  )
    .bind(id, transferAccountId, transactionId, unit, pricePerUnit, date, status, now, input.syncSource)
    .run();

  return { investmentPurchaseIds: [id], deletedInvestmentPurchaseIds: [] };
}

async function getTransactionInvestmentPurchaseId(env: Env, transactionId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT id FROM investment_purchases WHERE transaction_id = ?1 AND deleted_at IS NULL"
  )
    .bind(transactionId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

// Port PERSIS dari applyInvestmentTransactionEdit (desktop) -- field
// unit/harga tidak divalidasi terhadap nominal, tidak ada baris lain
// yang bergantung ke satu investment_purchases (beda dari debts yang
// bisa sudah dicicil) -- field berbahaya berubah -> hapus baris lama,
// buat baris baru dari nilai saat ini, selalu aman. Soft-delete (bukan
// hard DELETE SQL) krn baris ini ikut sync -- beda dari desktop yang
// hard-delete (desktop tidak punya kolom deleted_at di tabel ini).
export async function applyInvestmentTransactionEdit(
  env: Env,
  input: ApplyInvestmentTransactionInput
): Promise<TouchedInvestmentRows> {
  const existingId = await getTransactionInvestmentPurchaseId(env, input.transactionId);

  if (existingId == null) {
    return applyInvestmentTransaction(env, input);
  }

  const now = nowText();
  await env.DB.prepare("UPDATE investment_purchases SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, existingId)
    .run();

  const result = await applyInvestmentTransaction(env, input);
  return {
    investmentPurchaseIds: result.investmentPurchaseIds,
    deletedInvestmentPurchaseIds: [existingId, ...result.deletedInvestmentPurchaseIds],
  };
}

export type DeletedTransactionInvestmentInfo =
  | { role: "none" }
  | { role: "purchase"; investmentPurchaseId: string };

// Port PERSIS dari detachInvestmentPurchaseForDeletedTransaction (desktop)
// -- dipanggil SEBELUM/SESUDAH soft-delete baris `transactions` (lihat
// transactions/service.ts deleteTransaction, pola sama
// detachDebtForDeletedTransaction). Soft-delete (bukan hard DELETE) krn
// baris ini ikut sync.
export async function detachInvestmentPurchaseForDeletedTransaction(
  env: Env,
  transactionId: string
): Promise<DeletedTransactionInvestmentInfo> {
  const existingId = await getTransactionInvestmentPurchaseId(env, transactionId);
  if (existingId == null) return { role: "none" };

  const now = nowText();
  await env.DB.prepare("UPDATE investment_purchases SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, existingId)
    .run();

  return { role: "purchase", investmentPurchaseId: existingId };
}

export type PushResult = { status: "ok"; id: string } | { status: "stale" };

// Upsert-by-id MURNI utk baris investment_accounts yg desktop SUDAH buat
// sendiri (form akun investasi lokal) -- pola PERSIS pushDebtFromPc
// (debts/service.ts): desktop jalur tulis lokalnya sendiri, Worker cuma
// menerima apa adanya lewat endpoint /investments/accounts/push.
// account_id adalah PK (1:1 dgn accounts, lihat skema
// schema/0002_account_type_investment.sql) -- bukan `id` generik.
export async function pushInvestmentAccountFromPc(
  env: Env,
  payload: PushInvestmentAccountPayload,
  syncSource: SyncSource
): Promise<PushResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM investment_accounts WHERE account_id = ?1")
    .bind(payload.accountId)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const now = nowText();
  if (existing) {
    await env.DB.prepare(
      `UPDATE investment_accounts
       SET unit_label = ?1, current_market_value = ?2, updated_at = ?3, deleted_at = NULL
       WHERE account_id = ?4`
    )
      .bind(payload.unitLabel, payload.currentMarketValue, decision.updatedAt, payload.accountId)
      .run();
    return { status: "ok", id: payload.accountId };
  }

  await env.DB.prepare(
    `INSERT INTO investment_accounts
       (account_id, unit_label, current_market_value, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  )
    .bind(payload.accountId, payload.unitLabel, payload.currentMarketValue, now, decision.updatedAt, syncSource)
    .run();

  return { status: "ok", id: payload.accountId };
}

// Sejajar pushInvestmentAccountFromPc, utk investment_purchases -- BEDA
// dari applyInvestmentTransaction di atas: dipanggil dari endpoint push
// terpisah (/investments/purchases/push), dipakai desktop utk jalur yang
// TIDAK dipicu insert transaksi baru di Worker (mis. baris hasil edit
// settlement lokal lewat shared/investments/edit-purchase-form/, yang di
// desktop UPDATE langsung investment_purchases TANPA sentuh transactions/
// accounts.balance sama sekali). transactionId WAJIB (FK ke transactions
// yang SUDAH ada, baris ini turunan dari transaksi yang sudah di-push
// lebih dulu).
export async function pushInvestmentPurchaseFromPc(
  env: Env,
  payload: PushInvestmentPurchasePayload,
  syncSource: SyncSource
): Promise<PushResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM investment_purchases WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const now = nowText();
  if (existing) {
    await env.DB.prepare(
      `UPDATE investment_purchases
       SET account_id = ?1, transaction_id = ?2, unit = ?3, price_per_unit = ?4, date = ?5, status = ?6,
           updated_at = ?7, deleted_at = NULL
       WHERE id = ?8`
    )
      .bind(
        payload.accountId,
        payload.transactionId,
        payload.unit,
        payload.pricePerUnit,
        payload.date,
        payload.status ?? "pending",
        decision.updatedAt,
        payload.id
      )
      .run();
    return { status: "ok", id: payload.id };
  }

  await env.DB.prepare(
    `INSERT INTO investment_purchases
       (id, account_id, transaction_id, unit, price_per_unit, date, status, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  )
    .bind(
      payload.id,
      payload.accountId,
      payload.transactionId,
      payload.unit,
      payload.pricePerUnit,
      payload.date,
      payload.status ?? "pending",
      now,
      decision.updatedAt,
      syncSource
    )
    .run();

  return { status: "ok", id: payload.id };
}

export type DeletePushedResult = { status: "ok" } | { status: "not_found" };

// Soft-delete murni utk baris investment_purchases yg PC hapus lokal sbg
// bagian dari RECREATE (applyInvestmentTransactionEdit lokal: field
// berbahaya berubah -> hapus baris lama, insert baru dgn id BARU) --
// pola PERSIS deletePushedDebt (debts/service.ts). TANPA ini, baris lama
// menumpuk selamanya di D1 krn endpoint push cuma upsert-by-id.
export async function deletePushedInvestmentPurchase(env: Env, id: string): Promise<DeletePushedResult> {
  const existing = await env.DB.prepare(
    "SELECT id FROM investment_purchases WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = nowText();
  await env.DB.prepare("UPDATE investment_purchases SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}
