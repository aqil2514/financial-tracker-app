import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import { classifyAccountPair } from "../debts/classify-account-pair";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";
import type {
  PushInvestmentAccountPayload,
  PushInvestmentPurchasePayload,
  PushInvestmentSalePayload,
  CreateDirectInvestmentPurchasePayload,
  WriteOffInvestmentPayload,
} from "./schema";

async function getAccountType(env: Env, accountId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT account_type FROM accounts WHERE id = ?1 AND deleted_at IS NULL")
    .bind(accountId)
    .first<{ account_type: string }>();
  return row?.account_type ?? null;
}

// Port PERSIS dari
// apps/desktop/src/shared/investments/investment-holding-math.ts --
// SATU-SATUNYA sumber rumus ini di Worker (sama alasan dgn desktop:
// dipakai applySellInvestmentTransaction/settleInvestmentSale, supaya
// tidak drift). BEDA dari desktop: filter `deleted_at IS NULL` ditambah
// di KEDUA query (desktop tidak py kolom ini di investment_purchases/
// investment_sales) -- baris soft-deleted (hasil edit/delete transaksi
// via jalur MCP/push) TIDAK boleh ikut dihitung.
export async function getAverageCostPerUnit(env: Env, accountId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT SUM(unit * price_per_unit) AS total_cost, SUM(unit) AS total_unit
     FROM investment_purchases
     WHERE account_id = ?1 AND status = 'settled' AND deleted_at IS NULL`
  )
    .bind(accountId)
    .first<{ total_cost: number | null; total_unit: number | null }>();
  const totalUnit = row?.total_unit ?? 0;
  if (!totalUnit) return 0;
  return (row?.total_cost ?? 0) / totalUnit;
}

// Port PERSIS dari investment-holding-math.ts (getRemainingUnit) -- sisa
// unit yang BISA DIJUAL, bukan total_unit (yang mengikutkan pembelian
// pending, dipakai Unrealized P/L -- basis BEDA, lihat komentar desktop).
async function getRemainingUnit(env: Env, accountId: string): Promise<number> {
  const [purchaseRow, saleRow] = await Promise.all([
    env.DB.prepare(
      `SELECT SUM(unit) AS total_unit FROM investment_purchases
       WHERE account_id = ?1 AND status = 'settled' AND deleted_at IS NULL`
    )
      .bind(accountId)
      .first<{ total_unit: number | null }>(),
    env.DB.prepare(
      `SELECT SUM(unit) AS total_unit FROM investment_sales
       WHERE account_id = ?1 AND status IN ('pending', 'settled') AND deleted_at IS NULL`
    )
      .bind(accountId)
      .first<{ total_unit: number | null }>(),
  ]);

  const settledPurchased = purchaseRow?.total_unit ?? 0;
  const sold = saleRow?.total_unit ?? 0;
  return settledPurchased - sold;
}

// Port PERSIS dari InsufficientInvestmentUnitsError (desktop) -- dilempar
// saat unit yang mau dijual > sisa unit yang dimiliki, WAJIB ditolak
// (beda dari filosofi "tidak menghakimi data" saat BELI).
export class InsufficientInvestmentUnitsError extends Error {
  constructor(remainingUnit: number, requestedUnit: number) {
    super(
      `Unit yang dijual (${requestedUnit}) melebihi sisa unit yang dimiliki (${remainingUnit}). ` +
        `Kurangi jumlah unit yang dijual, atau periksa kembali riwayat pembelian/penjualan akun ini.`
    );
    this.name = "InsufficientInvestmentUnitsError";
  }
}

export type ValidateInvestmentSaleResult = { status: "ok" } | { status: "rejected"; reason: string };

// Pre-check REJECT SEBELUM SIMPAN -- dipanggil dari transactions/service.ts
// SEBELUM insert/update baris `transactions` arah investment->cash (jual),
// pola PERSIS validateDebtSettlementAmount (debts/service.ts): kalau
// reject terjadi SETELAH insert (di dalam applySellInvestmentTransaction),
// baris transaksi sudah terlanjur tersimpan tanpa investment_sales terkait
// (tidak atomic). `excludeSaleAccountIdUnit` dipakai jalur EDIT -- unit
// milik baris LAMA (yang akan direcreate) dikompensasi dulu sebelum
// membandingkan dengan unit baru, meniru urutan applySellInvestmentTransactionEdit
// yang menghapus baris lama SEBELUM menghitung ulang sisa unit.
export async function validateInvestmentSaleUnits(
  env: Env,
  {
    accountId,
    transferAccountId,
    unit,
    excludeUnit = 0,
  }: { accountId: string; transferAccountId: string | null; unit: number; excludeUnit?: number }
): Promise<ValidateInvestmentSaleResult> {
  if (transferAccountId == null) return { status: "ok" };

  const sourceType = await getAccountType(env, accountId);
  if (sourceType !== "investment") return { status: "ok" };

  const remainingUnit = (await getRemainingUnit(env, accountId)) + excludeUnit;
  if (unit > remainingUnit) {
    return {
      status: "rejected",
      reason: new InsufficientInvestmentUnitsError(remainingUnit, unit).message,
    };
  }
  return { status: "ok" };
}

// Port PERSIS logic deteksi+koreksi amount dari use-create-transaction.ts/
// use-update-transaction.ts (desktop) -- SUMBER KEBENARAN nominal transfer
// investment->cash BUKAN payload.amount yang dikirim client (field itu
// dikunci read-only di form desktop, cuma preview), melainkan
// averageCost x unit, dihitung ulang di SINI SEBELUM baris `transactions`
// di-insert/update (lihat konsep-investasi.md "Efek ke accounts.balance").
// null kalau bukan arah jual (bukan urusan fungsi ini) -- caller pakai
// payload.amount apa adanya.
export async function resolveInvestmentSellAmount(
  env: Env,
  { accountId, transferAccountId, unit }: { accountId: string; transferAccountId: string | null; unit: number | null }
): Promise<number | null> {
  if (transferAccountId == null || unit == null) return null;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(env, accountId),
    getAccountType(env, transferAccountId),
  ]);
  if (sourceType == null || destinationType == null) return null;

  let pairKind: string;
  try {
    pairKind = classifyAccountPair(sourceType, destinationType);
  } catch {
    return null; // UnsupportedAccountPairError -- bukan kombinasi investment, no-op.
  }
  if (pairKind !== "investment-cash") return null;

  const averageCost = await getAverageCostPerUnit(env, accountId);
  return averageCost * unit;
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

async function getTransactionInvestmentPurchaseRow(
  env: Env,
  transactionId: string
): Promise<{ id: string; unit: number | null; price_per_unit: number | null } | null> {
  const row = await env.DB.prepare(
    "SELECT id, unit, price_per_unit FROM investment_purchases WHERE transaction_id = ?1 AND deleted_at IS NULL"
  )
    .bind(transactionId)
    .first<{ id: string; unit: number | null; price_per_unit: number | null }>();
  return row ?? null;
}

// Port PERSIS dari applyInvestmentTransactionEdit (desktop) -- field
// unit/harga tidak divalidasi terhadap nominal, tidak ada baris lain
// yang bergantung ke satu investment_purchases (beda dari debts yang
// bisa sudah dicicil). Soft-delete (bukan hard DELETE SQL) krn baris ini
// ikut sync -- beda dari desktop yang hard-delete (desktop tidak punya
// kolom deleted_at di tabel ini).
//
// **Revisi 2026-10-08 (bug ditemukan lewat dogfooding, sama akar dgn
// desktop)**: delete-lalu-`applyInvestmentTransaction` HANYA aman utk
// `type === 'transfer'` -- fungsi itu `return none` utk income/expense,
// jadi baris lahir dari `record_mode: 'direct'` (income LANGSUNG pada
// akun investment, lihat createDirectInvestmentPurchase di bawah) yang
// diedit via MCP (`update_transaction`, tetap type='income') akan
// kehilangan baris `investment_purchases`-nya TANPA pengganti. Perbaikan
// PERSIS pola desktop: `type !== 'transfer'` -> UPDATE in-place, dengan
// fallback ke nilai LAMA kalau payload baru `null` (field unit/harga
// TIDAK PERNAH ditampilkan di form edit transaksi utama utk kasus ini,
// `null` dari situ berarti "belum terisi", bukan "user sengaja
// mengosongkan" -- lihat komentar sama di desktop).
export async function applyInvestmentTransactionEdit(
  env: Env,
  input: ApplyInvestmentTransactionInput
): Promise<TouchedInvestmentRows> {
  const existing = await getTransactionInvestmentPurchaseRow(env, input.transactionId);

  if (existing == null) {
    return applyInvestmentTransaction(env, input);
  }

  const now = nowText();

  if (input.type !== "transfer") {
    await env.DB.prepare(
      "UPDATE investment_purchases SET unit = ?1, price_per_unit = ?2, date = ?3, updated_at = ?4, sync_source = ?5 WHERE id = ?6"
    )
      .bind(
        input.unit ?? existing.unit,
        input.pricePerUnit ?? existing.price_per_unit,
        input.date,
        now,
        input.syncSource,
        existing.id
      )
      .run();
    return { investmentPurchaseIds: [existing.id], deletedInvestmentPurchaseIds: [] };
  }

  await env.DB.prepare("UPDATE investment_purchases SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, existing.id)
    .run();

  const result = await applyInvestmentTransaction(env, input);
  return {
    investmentPurchaseIds: result.investmentPurchaseIds,
    deletedInvestmentPurchaseIds: [existing.id, ...result.deletedInvestmentPurchaseIds],
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
  const existing = await getTransactionInvestmentPurchaseRow(env, transactionId);
  if (existing == null) return { role: "none" };

  const now = nowText();
  await env.DB.prepare("UPDATE investment_purchases SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, existing.id)
    .run();

  return { role: "purchase", investmentPurchaseId: existing.id };
}

// ============================================================
// Penjualan/penarikan sebagian -- port PERSIS
// apps/desktop/src/shared/investments/apply-sell-investment-transaction.ts.
// Jauh lebih kompleks dari pembelian: average cost, Realized P/L snapshot,
// validasi oversell, dua jalur status (pending TANPA transaksi apa pun
// sama sekali, settled DENGAN leg transfer + leg penyesuaian P/L) -- lihat
// komentar panjang applySellInvestmentTransaction desktop utk penjelasan
// lengkap keputusan arsitektur "dana BARU cair saat settled".
// ============================================================

export type ApplySellInvestmentTransactionInput = {
  // Id baris `transactions` leg transfer UTAMA (investment -> cash,
  // amount = averageCost x unit) yang SUDAH di-INSERT oleh caller SEBELUM
  // memanggil fungsi ini -- WAJIB diisi kalau status 'settled', HARUS
  // null kalau status 'pending'.
  transactionId: string | null;
  accountId: string;
  transferAccountId: string | null;
  date: string;
  unit: number;
  pricePerUnit: number;
  status?: "pending" | "settled";
  syncSource: SyncSource;
};

export type TouchedInvestmentSaleRows = {
  investmentSaleIds: string[];
  deletedInvestmentSaleIds: string[];
  adjustmentTransactionId: string | null;
};

const noneSale: TouchedInvestmentSaleRows = {
  investmentSaleIds: [],
  deletedInvestmentSaleIds: [],
  adjustmentTransactionId: null,
};

// Port PERSIS applySellInvestmentTransaction (desktop) -- dipanggil dari
// transactions/service.ts SETELAH baris `transactions` tersimpan (status
// settled) ATAU langsung tanpa transaksi apa pun (status pending, lihat
// endpoint POST /investments/sales khusus di bawah -- BEDA dari pembelian
// yang SELALU dipicu dari transactions/service.ts, jual pending TIDAK
// pernah melibatkan transactions/service.ts sama sekali).
export async function applySellInvestmentTransaction(
  env: Env,
  input: ApplySellInvestmentTransactionInput
): Promise<TouchedInvestmentSaleRows> {
  const { transactionId, accountId, transferAccountId, date, unit, pricePerUnit, status = "pending" } = input;

  // accountId harus bertipe investment -- berlaku utk KEDUA status. Lihat
  // komentar desktop: transferAccountId SELALU null utk pending (baris
  // pending tidak menyimpan akun kas), jadi pasangan lengkap baru bisa
  // divalidasi lewat classifyAccountPair di cabang 'settled' di bawah.
  const sourceType = await getAccountType(env, accountId);
  if (sourceType !== "investment") return noneSale;

  // Validasi oversell WAJIB dicek sebelum cabang status -- berlaku utk
  // KEDUA status (unit sudah dikurangi optimis sejak pending).
  const remainingUnit = await getRemainingUnit(env, accountId);
  if (unit > remainingUnit) {
    throw new InsufficientInvestmentUnitsError(remainingUnit, unit);
  }

  const saleId = uuidv7();
  const now = nowText();

  if (status === "pending") {
    await env.DB.prepare(
      `INSERT INTO investment_sales
         (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit,
          average_cost_per_unit, realized_pl, date, status, created_at, updated_at, sync_source)
       VALUES (?1, ?2, NULL, NULL, ?3, ?4, NULL, NULL, ?5, 'pending', ?6, ?6, ?7)`
    )
      .bind(saleId, accountId, unit, pricePerUnit, date, now, input.syncSource)
      .run();
    return { investmentSaleIds: [saleId], deletedInvestmentSaleIds: [], adjustmentTransactionId: null };
  }

  if (transactionId == null) {
    throw new Error("transactionId wajib diisi untuk status 'settled' (leg transfer utama harus sudah di-insert).");
  }
  if (transferAccountId == null) {
    throw new Error("transferAccountId wajib diisi untuk status 'settled'.");
  }

  const destinationType = await getAccountType(env, transferAccountId);
  if (destinationType == null) {
    throw new Error("Akun sumber/tujuan transfer tidak ditemukan.");
  }

  const pairKind = classifyAccountPair(sourceType, destinationType);
  if (pairKind !== "investment-cash") return noneSale;

  const averageCost = await getAverageCostPerUnit(env, accountId);
  const { adjustmentTransactionId, realizedPl } = await createAdjustmentTransaction(env, {
    transferAccountId,
    date,
    unit,
    pricePerUnit,
    averageCost,
    syncSource: input.syncSource,
  });

  await env.DB.prepare(
    `INSERT INTO investment_sales
       (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit,
        average_cost_per_unit, realized_pl, date, status, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'settled', ?10, ?10, ?11)`
  )
    .bind(
      saleId,
      accountId,
      transactionId,
      adjustmentTransactionId,
      unit,
      pricePerUnit,
      averageCost,
      realizedPl,
      date,
      now,
      input.syncSource
    )
    .run();

  return { investmentSaleIds: [saleId], deletedInvestmentSaleIds: [], adjustmentTransactionId };
}

// Port PERSIS createAdjustmentTransaction (desktop) -- leg penyesuaian P/L
// (kalau ada selisih realizedPl), dipakai BERSAMA applySellInvestmentTransaction
// (settled langsung saat create) dan settleInvestmentSale (settle baris
// pending). Average cost dihitung CALLER, dioper sbg parameter.
async function createAdjustmentTransaction(
  env: Env,
  params: {
    transferAccountId: string;
    date: string;
    unit: number;
    pricePerUnit: number;
    averageCost: number;
    syncSource: SyncSource;
  }
): Promise<{ adjustmentTransactionId: string | null; realizedPl: number }> {
  const { transferAccountId, date, unit, pricePerUnit, averageCost, syncSource } = params;
  const realizedPl = (pricePerUnit - averageCost) * unit;

  let adjustmentTransactionId: string | null = null;
  if (realizedPl !== 0) {
    adjustmentTransactionId = uuidv7();
    const adjustmentType = realizedPl > 0 ? "income" : "expense";
    const now = nowText();
    await env.DB.prepare(
      `INSERT INTO transactions
         (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
          created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, NULL, ?4, NULL, ?5, ?6, NULL, ?7, ?7, ?8)`
    )
      .bind(
        adjustmentTransactionId,
        adjustmentType,
        Math.abs(realizedPl),
        transferAccountId,
        "Realized P/L penjualan investasi",
        date,
        now,
        syncSource
      )
      .run();
  }

  return { adjustmentTransactionId, realizedPl };
}

// Port PERSIS settleInvestmentSale (desktop) -- settle satu baris pending,
// baru di titik INI dana benar-benar "cair": leg transfer utama +
// penyesuaian P/L dibuat, average cost & Realized P/L dihitung dari
// kondisi SAAT INI dan disimpan permanen. transferAccountId (akun kas
// tujuan) WAJIB dioper eksplisit oleh caller -- investment_sales TIDAK
// menyimpan akun kas tujuan sejak create.
export type SettleInvestmentSaleResult =
  | { status: "ok"; transactionId: string; adjustmentTransactionId: string | null }
  | { status: "not_found" }
  | { status: "rejected"; reason: string };

export async function settleInvestmentSale(
  env: Env,
  saleId: string,
  transferAccountId: string,
  syncSource: SyncSource
): Promise<SettleInvestmentSaleResult> {
  const sale = await env.DB.prepare(
    `SELECT account_id, unit, price_per_unit, date, status, transaction_id
     FROM investment_sales WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(saleId)
    .first<{
      account_id: string;
      unit: number;
      price_per_unit: number;
      date: string;
      status: string;
      transaction_id: string | null;
    }>();
  if (sale == null) return { status: "not_found" };
  if (sale.status === "settled" || sale.transaction_id != null) {
    return { status: "rejected", reason: "Penjualan ini sudah settled." };
  }

  // Tidak perlu validasi oversell ulang -- unit baris ini SUDAH ikut
  // dihitung sebagai "terjual" oleh getRemainingUnit sejak status pending,
  // sudah ditegakkan saat applySellInvestmentTransaction membuat baris ini.

  const averageCostForTransfer = await getAverageCostPerUnit(env, sale.account_id);
  const transactionId = uuidv7();
  const now = nowText();
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
        created_at, updated_at, sync_source)
     VALUES (?1, 'transfer', ?2, NULL, ?3, ?4, ?5, ?6, NULL, ?7, ?7, ?8)`
  )
    .bind(
      transactionId,
      averageCostForTransfer * sale.unit,
      sale.account_id,
      transferAccountId,
      "Settlement penjualan investasi",
      sale.date,
      now,
      syncSource
    )
    .run();

  const { adjustmentTransactionId, realizedPl } = await createAdjustmentTransaction(env, {
    transferAccountId,
    date: sale.date,
    unit: sale.unit,
    pricePerUnit: sale.price_per_unit,
    averageCost: averageCostForTransfer,
    syncSource,
  });

  await env.DB.prepare(
    `UPDATE investment_sales
     SET transaction_id = ?1, adjustment_transaction_id = ?2, average_cost_per_unit = ?3, realized_pl = ?4,
         status = 'settled', updated_at = ?5
     WHERE id = ?6`
  )
    .bind(transactionId, adjustmentTransactionId, averageCostForTransfer, realizedPl, now, saleId)
    .run();

  return { status: "ok", transactionId, adjustmentTransactionId };
}

// price_per_unit > 0 membedakan JUAL biasa dari write-off (price_per_unit
// SELALU 0 utk write-off, lihat writeOffInvestment di bawah) -- PENTING:
// tanpa filter ini, transaksi write-off yang diedit via MCP salah
// terdeteksi sbg jual oleh applySellInvestmentTransactionEdit (ditemukan
// 2026-10-08, port dari gap yang sama di desktop/apply-write-off-
// investment-transaction.ts getTransactionWriteOffSale -- `deleted_at IS
// NULL` ATAU `adjustment_transaction_id IS NULL` saja TIDAK CUKUP, jual
// biasa dgn realizedPl kebetulan 0 juga punya adjustment_transaction_id
// NULL).
async function getTransactionInvestmentSale(env: Env, transactionId: string): Promise<{ id: string } | null> {
  const row = await env.DB.prepare(
    "SELECT id FROM investment_sales WHERE transaction_id = ?1 AND deleted_at IS NULL AND price_per_unit > 0"
  )
    .bind(transactionId)
    .first<{ id: string }>();
  return row ?? null;
}

// Dipakai transactions/service.ts (precheck oversell jalur EDIT) --
// ambil unit milik baris investment_sales LAMA transaksi yang sedang
// diedit, utk dikompensasi SEBELUM membandingkan dengan unit baru (meniru
// urutan applySellInvestmentTransactionEdit yang menghapus baris lama
// dulu sebelum menghitung ulang sisa unit). 0 kalau transaksi ini belum
// pernah jadi baris investment_sales (create murni, bukan edit), ATAU
// baris itu sebenarnya write-off (price_per_unit = 0, bukan urusan precheck
// oversell JUAL -- write-off punya validasi oversell sendiri di
// writeOffInvestment).
export async function getTransactionInvestmentSaleUnit(env: Env, transactionId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT unit FROM investment_sales WHERE transaction_id = ?1 AND deleted_at IS NULL AND price_per_unit > 0"
  )
    .bind(transactionId)
    .first<{ unit: number }>();
  return row?.unit ?? 0;
}

// Port PERSIS applySellInvestmentTransactionEdit (desktop) -- HANYA
// dipanggil dari transactions/service.ts (form transaksi utama, yang
// cuma mendukung jual 'settled') -- baris investment_sales yang diedit di
// sini SELALU sudah py transaction_id terisi.
export async function applySellInvestmentTransactionEdit(
  env: Env,
  transactionId: string,
  input: ApplySellInvestmentTransactionInput
): Promise<TouchedInvestmentSaleRows> {
  const existing = await getTransactionInvestmentSale(env, transactionId);

  if (existing == null) {
    return applySellInvestmentTransaction(env, { ...input, status: "settled" });
  }

  await deleteInvestmentSaleAndAdjustment(env, existing.id);
  const result = await applySellInvestmentTransaction(env, { ...input, status: "settled" });
  return {
    investmentSaleIds: result.investmentSaleIds,
    deletedInvestmentSaleIds: [existing.id, ...result.deletedInvestmentSaleIds],
    adjustmentTransactionId: result.adjustmentTransactionId,
  };
}

// Port PERSIS deleteInvestmentSaleAndAdjustment (desktop) -- BEDA: soft-
// delete (bukan hard DELETE SQL) utk KEDUA baris (investment_sales +
// transaksi penyesuaian P/L miliknya) krn keduanya ikut sync. Mengembalikan
// id transaksi penyesuaian yang ikut di-soft-delete (atau null).
async function deleteInvestmentSaleAndAdjustment(env: Env, saleId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT adjustment_transaction_id FROM investment_sales WHERE id = ?1"
  )
    .bind(saleId)
    .first<{ adjustment_transaction_id: string | null }>();
  const adjustmentId = row?.adjustment_transaction_id ?? null;

  const now = nowText();
  await env.DB.prepare("UPDATE investment_sales SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, saleId)
    .run();

  if (adjustmentId != null) {
    await env.DB.prepare("UPDATE transactions SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
      .bind(now, adjustmentId)
      .run();
  }
  return adjustmentId;
}

export type DeletedTransactionInvestmentSaleInfo =
  | { role: "none" }
  | { role: "sale"; investmentSaleId: string; adjustmentTransactionId: string | null };

// Port PERSIS detachInvestmentSaleForDeletedTransaction (desktop) --
// dipanggil dari transactions/service.ts deleteTransaction, TANPA guard
// syncSource (pola sama detachInvestmentPurchaseForDeletedTransaction).
export async function detachInvestmentSaleForDeletedTransaction(
  env: Env,
  transactionId: string
): Promise<DeletedTransactionInvestmentSaleInfo> {
  const existing = await getTransactionInvestmentSale(env, transactionId);
  if (existing == null) return { role: "none" };

  const adjustmentTransactionId = await deleteInvestmentSaleAndAdjustment(env, existing.id);
  return { role: "sale", investmentSaleId: existing.id, adjustmentTransactionId };
}

export type DeletePendingInvestmentSaleResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "rejected"; reason: string };

// Port PERSIS deletePendingInvestmentSale (desktop) -- hapus baris
// investment_sales yang MASIH pending, dipanggil LANGSUNG dari UI riwayat
// penjualan (BUKAN dari jalur hapus transaksi). BEDA: soft-delete (bukan
// hard DELETE).
export async function deletePendingInvestmentSale(env: Env, saleId: string): Promise<DeletePendingInvestmentSaleResult> {
  const sale = await env.DB.prepare(
    "SELECT status, transaction_id FROM investment_sales WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(saleId)
    .first<{ status: string; transaction_id: string | null }>();
  if (sale == null) return { status: "not_found" };
  if (sale.status === "settled" || sale.transaction_id != null) {
    return { status: "rejected", reason: "Penjualan yang sudah settled hanya bisa dihapus lewat hapus transaksinya." };
  }

  const now = nowText();
  await env.DB.prepare("UPDATE investment_sales SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, saleId)
    .run();
  return { status: "ok" };
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

// Sejajar pushInvestmentPurchaseFromPc, utk investment_sales -- upsert-by-id
// MURNI dipakai desktop utk jalur yang TIDAK dipicu insert transaksi baru
// di Worker: status 'pending' (TIDAK PERNAH melibatkan transactions/
// service.ts sama sekali, lihat applySellInvestmentTransaction) ATAU
// 'settled' hasil dialog "Jual Investasi" khusus (transaksinya di-push
// terpisah via /transactions/push, baris investment_sales-nya di sini).
export async function pushInvestmentSaleFromPc(
  env: Env,
  payload: PushInvestmentSalePayload,
  syncSource: SyncSource
): Promise<PushResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM investment_sales WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const now = nowText();
  if (existing) {
    await env.DB.prepare(
      `UPDATE investment_sales
       SET account_id = ?1, transaction_id = ?2, adjustment_transaction_id = ?3, unit = ?4, price_per_unit = ?5,
           average_cost_per_unit = ?6, realized_pl = ?7, date = ?8, status = ?9, updated_at = ?10, deleted_at = NULL
       WHERE id = ?11`
    )
      .bind(
        payload.accountId,
        payload.transactionId,
        payload.adjustmentTransactionId,
        payload.unit,
        payload.pricePerUnit,
        payload.averageCostPerUnit,
        payload.realizedPl,
        payload.date,
        payload.status ?? "pending",
        decision.updatedAt,
        payload.id
      )
      .run();
    return { status: "ok", id: payload.id };
  }

  await env.DB.prepare(
    `INSERT INTO investment_sales
       (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit,
        average_cost_per_unit, realized_pl, date, status, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
  )
    .bind(
      payload.id,
      payload.accountId,
      payload.transactionId,
      payload.adjustmentTransactionId,
      payload.unit,
      payload.pricePerUnit,
      payload.averageCostPerUnit,
      payload.realizedPl,
      payload.date,
      payload.status ?? "pending",
      now,
      decision.updatedAt,
      syncSource
    )
    .run();

  return { status: "ok", id: payload.id };
}

// Sejajar deletePushedInvestmentPurchase, utk investment_sales -- soft-
// delete murni utk baris yg PC hapus lokal sbg bagian dari RECREATE
// (applySellInvestmentTransactionEdit lokal).
export async function deletePushedInvestmentSale(env: Env, id: string): Promise<DeletePushedResult> {
  const existing = await env.DB.prepare("SELECT id FROM investment_sales WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = nowText();
  await env.DB.prepare("UPDATE investment_sales SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}

// ============================================================
// Unit yang berubah TANPA transfer kas -- port PERSIS
// apps/desktop/src/shared/investments/{apply-investment-transaction.ts
// cabang direct, apply-write-off-investment-transaction.ts}. Pola yg
// dipakai PERSIS createDirectDebt/writeOffDebt (modul debts) -- satu
// transaksi income/expense LANGSUNG pada akun investment itu sendiri,
// BUKAN upsert-by-id push (desktop TIDAK bisa membuat baris ini lebih
// dulu di sini, karena endpoint ini jg dipanggil LANGSUNG dari MCP tanpa
// lewat desktop sama sekali). Lihat docs/concept/konsep-investasi.md
// "Unit yang berubah TANPA transfer kas".
// ============================================================

export type CreateDirectInvestmentPurchaseResult =
  | { status: "ok"; id: string; transactionId: string }
  | { status: "stale" }
  | { status: "rejected"; reason: string };

// Port PERSIS cabang record_mode='direct' di
// apps/desktop/src/shared/investments/new-purchase-form/use-create-investment-purchase.ts.
// accountId WAJIB akun bertipe 'investment'. transaction_id TIDAK NULL
// (satu transaksi income dibuat LANGSUNG di sini, arah sebaliknya dari
// write-off di bawah) -- status investment_purchases SELALU 'settled'
// (nilainya sudah pasti saat diterima, tidak ada konsep pending utk
// hibah/bonus).
export async function createDirectInvestmentPurchase(
  env: Env,
  payload: CreateDirectInvestmentPurchasePayload,
  syncSource: SyncSource
): Promise<CreateDirectInvestmentPurchaseResult> {
  const existing = await env.DB.prepare(
    "SELECT updated_at, transaction_id FROM investment_purchases WHERE id = ?1"
  )
    .bind(payload.id)
    .first<{ updated_at: string | null; transaction_id: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const accountType = await getAccountType(env, payload.accountId);
  if (accountType == null) {
    return { status: "rejected", reason: "Akun tidak ditemukan." };
  }
  if (accountType !== "investment") {
    return {
      status: "rejected",
      reason: "Pembelian investasi mode langsung wajib menunjuk ke akun bertipe 'investment'.",
    };
  }

  // Idempotency MURNI (bukan edit) -- endpoint ini create-only dari MCP
  // (tidak ada jalur edit mode direct), existing cuma relevan kalau
  // permintaan yang sama dikirim ulang (timeout, retry) -- transaksi
  // income LAMA tetap apa adanya, transactionId-nya yang sudah tersimpan
  // dikembalikan ulang.
  if (existing && existing.transaction_id != null) {
    return { status: "ok", id: payload.id, transactionId: existing.transaction_id };
  }

  const now = nowText();
  const transactionId = uuidv7();
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
        created_at, updated_at, sync_source)
     VALUES (?1, 'income', ?2, NULL, ?3, NULL, ?4, ?5, NULL, ?6, ?6, ?7)`
  )
    .bind(transactionId, payload.amount, payload.accountId, payload.note ?? null, payload.date, now, syncSource)
    .run();

  await env.DB.prepare(
    `INSERT INTO investment_purchases
       (id, account_id, transaction_id, unit, price_per_unit, date, status, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'settled', ?7, ?7, ?8)`
  )
    .bind(payload.id, payload.accountId, transactionId, payload.unit, payload.pricePerUnit, payload.date, now, syncSource)
    .run();

  return { status: "ok", id: payload.id, transactionId };
}

export type WriteOffInvestmentResult =
  | { status: "ok"; id: string; transactionId: string; averageCost: number }
  | { status: "stale" }
  | { status: "rejected"; reason: string };

// Port PERSIS apply-write-off-investment-transaction.ts (desktop) --
// BEDA dari applySellInvestmentTransaction: TIDAK PERNAH punya akun kas
// tujuan, jadi TIDAK bisa reuse fungsi itu (transferAccountId wajib di
// sana utk status settled). Satu transaksi 'expense' dibuat LANGSUNG
// pada akun investment itu sendiri (pola write_off_debt, bukan
// applySellInvestmentTransaction), sebesar averageCost x unit -- user
// cuma kirim unit, nominal DIHITUNG di sini (bukan dari payload).
export async function writeOffInvestment(
  env: Env,
  payload: WriteOffInvestmentPayload,
  syncSource: SyncSource
): Promise<WriteOffInvestmentResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM investment_sales WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const accountType = await getAccountType(env, payload.accountId);
  if (accountType == null) {
    return { status: "rejected", reason: "Akun tidak ditemukan." };
  }
  if (accountType !== "investment") {
    return { status: "rejected", reason: "Write-off wajib menunjuk ke akun bertipe 'investment'." };
  }

  if (existing) {
    return { status: "rejected", reason: "Write-off ini sudah pernah dicatat." };
  }

  const remainingUnit = await getRemainingUnit(env, payload.accountId);
  if (payload.unit > remainingUnit) {
    return {
      status: "rejected",
      reason: new InsufficientInvestmentUnitsError(remainingUnit, payload.unit).message,
    };
  }

  const averageCost = await getAverageCostPerUnit(env, payload.accountId);
  const amount = averageCost * payload.unit;
  const realizedPl = -amount;

  const now = nowText();
  const transactionId = uuidv7();
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
        created_at, updated_at, sync_source)
     VALUES (?1, 'expense', ?2, NULL, ?3, NULL, ?4, ?5, NULL, ?6, ?6, ?7)`
  )
    .bind(transactionId, amount, payload.accountId, payload.note ?? null, payload.date, now, syncSource)
    .run();

  await env.DB.prepare(
    `INSERT INTO investment_sales
       (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit,
        average_cost_per_unit, realized_pl, date, status, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, NULL, ?4, 0, ?5, ?6, ?7, 'settled', ?8, ?8, ?9)`
  )
    .bind(payload.id, payload.accountId, transactionId, payload.unit, averageCost, realizedPl, payload.date, now, syncSource)
    .run();

  return { status: "ok", id: payload.id, transactionId, averageCost };
}

// price_per_unit = 0 adalah ciri KHUSUS write-off -- lihat komentar
// panjang di getTransactionInvestmentSale di atas (price_per_unit > 0
// membedakan jual dari write-off, bukan adjustment_transaction_id).
async function getTransactionWriteOffSale(
  env: Env,
  transactionId: string
): Promise<{ id: string; unit: number } | null> {
  const row = await env.DB.prepare(
    "SELECT id, unit FROM investment_sales WHERE transaction_id = ?1 AND deleted_at IS NULL AND price_per_unit = 0"
  )
    .bind(transactionId)
    .first<{ id: string; unit: number }>();
  return row ?? null;
}

// Dipakai transactions/service.ts SEBELUM memutuskan cabang edit mana
// yang dipanggil (direct-purchase/write-off/jual/transfer biasa) -- port
// PERSIS getTransactionWriteOff (desktop).
export async function getTransactionWriteOff(
  env: Env,
  transactionId: string
): Promise<{ id: string; unit: number } | null> {
  return getTransactionWriteOffSale(env, transactionId);
}

export type ApplyWriteOffInvestmentTransactionEditInput = {
  transactionId: string;
  accountId: string;
  unit: number;
  syncSource: SyncSource;
};

export type WriteOffInvestmentTransactionEditResult = {
  amount: number;
  averageCost: number;
};

// Port PERSIS applyWriteOffInvestmentTransactionEdit (desktop) -- UPDATE
// in-place pada baris investment_sales yang sama (BUKAN delete+recreate
// seperti applySellInvestmentTransactionEdit -- write-off TIDAK PERNAH
// punya leg penyesuaian P/L di akun kas, jadi tidak ada transaksi kedua
// yang perlu diurus). amount/realized_pl dihitung ULANG dari averageCost
// SAAT INI (bisa sudah bergeser sejak baris ini pertama dibuat) -- caller
// (transactions/service.ts) WAJIB menulis amount hasil ini ke kolom
// transactions.amount, persis pola applySellInvestmentTransactionEdit.
export async function applyWriteOffInvestmentTransactionEdit(
  env: Env,
  { transactionId, accountId, unit, syncSource }: ApplyWriteOffInvestmentTransactionEditInput
): Promise<WriteOffInvestmentTransactionEditResult> {
  const existing = await getTransactionWriteOffSale(env, transactionId);
  if (existing == null) {
    throw new Error("Baris write-off investasi untuk transaksi ini tidak ditemukan.");
  }

  const averageCost = await getAverageCostPerUnit(env, accountId);
  const amount = averageCost * unit;
  const realizedPl = -amount;

  const now = nowText();
  await env.DB.prepare(
    "UPDATE investment_sales SET unit = ?1, average_cost_per_unit = ?2, realized_pl = ?3, updated_at = ?4, sync_source = ?5 WHERE id = ?6"
  )
    .bind(unit, averageCost, realizedPl, now, syncSource, existing.id)
    .run();

  return { amount, averageCost };
}
