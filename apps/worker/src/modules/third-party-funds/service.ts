import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";
import { resolveContactId } from "../contacts/service";
import type { PushThirdPartyFundPayload, CreateDirectThirdPartyFundPayload } from "./schema";

async function getAccountType(env: Env, accountId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT account_type FROM accounts WHERE id = ?1 AND deleted_at IS NULL")
    .bind(accountId)
    .first<{ account_type: string }>();
  return row?.account_type ?? null;
}

// Port PERSIS dari
// apps/desktop/src/shared/third-party-funds/remaining-third-party-fund-sql.ts
// (getRemainingThirdPartyFund) -- sisa titipan per (account_id,
// contact_id), BUKAN kolom tersimpan (tidak ada konsep status lunas,
// beda dari debts/investments). BEDA dari desktop: filter `deleted_at
// IS NULL` ditambah (desktop tidak py kolom ini) -- baris soft-deleted
// (hasil edit/delete via jalur MCP/push) TIDAK boleh ikut dihitung.
export async function getRemainingThirdPartyFund(
  env: Env,
  accountId: string,
  contactId: string,
  excludeId?: string
): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS remaining
     FROM third_party_funds
     WHERE account_id = ?1 AND contact_id = ?2 AND deleted_at IS NULL
       AND (?3 IS NULL OR id != ?3)`
  )
    .bind(accountId, contactId, excludeId ?? null)
    .first<{ remaining: number }>();
  return row?.remaining ?? 0;
}

// Port PERSIS dari InsufficientThirdPartyFundError (desktop) -- dilempar
// saat nominal "ambil" (direction 'out') > sisa titipan kontak tersebut
// di akun ini, WAJIB ditolak.
export class InsufficientThirdPartyFundError extends Error {
  constructor(remaining: number, requested: number) {
    super(
      `Nominal yang diambil (${requested}) melebihi sisa titipan kontak ini di akun ini (${remaining}). ` +
        `Periksa kembali nominal, akun, atau kontak yang dipilih.`
    );
    this.name = "InsufficientThirdPartyFundError";
  }
}

async function insertThirdPartyFund(
  env: Env,
  params: {
    accountId: string;
    contactId: string;
    transactionId: string | null;
    direction: "in" | "out";
    amount: number;
    date: string;
    note: string | null;
    syncSource: SyncSource;
  }
): Promise<string> {
  const id = uuidv7();
  const now = nowText();
  await env.DB.prepare(
    `INSERT INTO third_party_funds
       (id, account_id, contact_id, transaction_id, direction, amount, date, note, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10)`
  )
    .bind(
      id,
      params.accountId,
      params.contactId,
      params.transactionId,
      params.direction,
      params.amount,
      params.date,
      params.note,
      now,
      params.syncSource
    )
    .run();
  return id;
}

export type TouchedThirdPartyFundRows = {
  thirdPartyFundIds: string[];
  deletedThirdPartyFundIds: string[];
};

const none: TouchedThirdPartyFundRows = { thirdPartyFundIds: [], deletedThirdPartyFundIds: [] };

// Port PERSIS dari
// apps/desktop/src/shared/third-party-funds/apply-third-party-transaction.ts
// (applyDirectThirdPartyTransaction) -- titip masuk/ambil keluar pada
// SATU akun third_party, pola income/expense SATU SISI (seperti
// investasi record_mode: direct), BUKAN trigger dari transfer. Dipanggil
// dari transactions/service.ts SETELAH baris `transactions` tersimpan --
// TAPI validasi oversell (getRemainingThirdPartyFund) WAJIB dicek
// SEBELUM insert transaksi oleh CALLER (lihat bug desktop yang pernah
// ditemukan: insert-sebelum-validate meninggalkan transaksi yatim tanpa
// rollback nyata -- precheck terpisah validateDirectThirdPartyTransaction
// di bawah, dipanggil dari transactions/service.ts SEBELUM insert).
export type ApplyDirectThirdPartyTransactionInput = {
  transactionId: string;
  type: "income" | "expense";
  accountId: string;
  contactId: string;
  amount: number;
  date: string;
  note?: string | null;
  syncSource: SyncSource;
};

export async function applyDirectThirdPartyTransaction(
  env: Env,
  { transactionId, type, accountId, contactId, amount, date, note = null, syncSource }: ApplyDirectThirdPartyTransactionInput
): Promise<TouchedThirdPartyFundRows> {
  const direction = type === "income" ? "in" : "out";

  if (direction === "out") {
    const remaining = await getRemainingThirdPartyFund(env, accountId, contactId);
    if (amount > remaining) {
      throw new InsufficientThirdPartyFundError(remaining, amount);
    }
  }

  const id = await insertThirdPartyFund(env, { accountId, contactId, transactionId, direction, amount, date, note, syncSource });
  return { thirdPartyFundIds: [id], deletedThirdPartyFundIds: [] };
}

export type ValidateThirdPartyResult = { status: "ok" } | { status: "rejected"; reason: string };

// Pre-check REJECT SEBELUM SIMPAN -- dipanggil dari transactions/
// service.ts SEBELUM insert/update baris `transactions` arah income/
// expense pada akun third_party, pola PERSIS validateInvestmentSaleUnits
// (investments/service.ts): kalau reject terjadi SETELAH insert, baris
// transaksi sudah terlanjur tersimpan tanpa third_party_funds terkait
// (tidak atomic). `excludeId` dipakai jalur EDIT -- baris LAMA (yang
// akan direcreate/di-UPDATE) dikompensasi dulu, meniru urutan
// getRemainingThirdPartyFundExcluding desktop.
//
// **Bug ditemukan 2026-10-21 (dogfooding, port dari bug desktop yang
// sama)**: versi SEBELUMNYA cuma validasi kalau `type === "expense"`
// (arah 'out' bertambah/baru) -- padahal MENGECILKAN baris 'income'
// (arah 'in') yang sudah ada via EDIT sama bahayanya kalau sudah ada
// 'out' yang bergantung padanya (sisa bisa jadi NEGATIF, lolos tanpa
// ditolak). Diperbaiki jadi berlaku utk KEDUA arah: dicek via
// `excludeId` SELALU (bukan cuma saat expense) -- `remainingExcluding`
// dihitung TANPA baris lama, lalu `amount` BARU diterapkan ulang sesuai
// `type` barunya, hasilnya WAJIB >= 0.
export async function validateDirectThirdPartyTransaction(
  env: Env,
  {
    type,
    accountId,
    contactId,
    amount,
    excludeId,
  }: { type: "income" | "expense" | "transfer"; accountId: string; contactId: string | null; amount: number; excludeId?: string }
): Promise<ValidateThirdPartyResult> {
  if (type === "transfer" || contactId == null) return { status: "ok" };

  const accountType = await getAccountType(env, accountId);
  if (accountType !== "third_party") return { status: "ok" };

  const remainingExcluding = await getRemainingThirdPartyFund(env, accountId, contactId, excludeId);
  const remainingAfterWrite = type === "income" ? remainingExcluding + amount : remainingExcluding - amount;
  if (remainingAfterWrite < 0) {
    if (type === "expense") {
      return { status: "rejected", reason: new InsufficientThirdPartyFundError(remainingExcluding, amount).message };
    }
    const minimumAmount = -remainingExcluding;
    return {
      status: "rejected",
      reason: `Nominal titip tidak bisa diturunkan sampai ${amount} -- sudah ada riwayat ambil yang bergantung pada titipan ini, minimal ${minimumAmount} supaya sisa titipan tidak negatif.`,
    };
  }
  return { status: "ok" };
}

async function getTransactionThirdPartyFundRow(env: Env, transactionId: string): Promise<ExistingThirdPartyFundRow | null> {
  const row = await env.DB.prepare(
    "SELECT id, account_id, contact_id, direction, amount FROM third_party_funds WHERE transaction_id = ?1 AND deleted_at IS NULL LIMIT 1"
  )
    .bind(transactionId)
    .first<ExistingThirdPartyFundRow>();
  return row ?? null;
}

// Dipakai transactions/service.ts (precheck oversell jalur EDIT) --
// id baris third_party_funds milik transaksi yang sedang diedit (kalau
// ada), utk dioper sbg excludeId ke validateDirectThirdPartyTransaction
// (baris lama dikompensasi dulu sebelum membandingkan dgn nominal baru,
// pola PERSIS getTransactionInvestmentSaleUnit).
export async function getTransactionThirdPartyFundId(env: Env, transactionId: string): Promise<string | undefined> {
  const row = await getTransactionThirdPartyFundRow(env, transactionId);
  return row?.id;
}

// Port PERSIS cabang `type !== 'transfer'` di applyInvestmentTransactionEdit
// (desktop TIDAK punya fungsi edit sendiri utk third_party_funds direct --
// use-edit-third-party-fund.ts di desktop UPDATE langsung tanpa helper
// terpisah, pola yg sama direplikasi di sini) -- UPDATE in-place baris
// yang sama (BUKAN delete+recreate, beda dari applySellInvestmentTransactionEdit)
// krn tidak ada baris lain yang bergantung ke satu third_party_funds
// (tidak ada konsep "sudah dipakai" seperti investment_purchases
// settled). direction TIDAK diubah -- income<->expense edit SEHARUSNYA
// tidak terjadi lewat form transaksi utama (field type terkunci utk
// baris yg sudah py padanan third_party_funds), tapi dijaga di sini
// sbg defense-in-depth: direction ikut disesuaikan dari type baru.
export async function applyDirectThirdPartyTransactionEdit(
  env: Env,
  input: ApplyDirectThirdPartyTransactionInput
): Promise<TouchedThirdPartyFundRows> {
  const existing = await getTransactionThirdPartyFundRow(env, input.transactionId);

  if (existing == null) {
    return applyDirectThirdPartyTransaction(env, input);
  }

  const direction = input.type === "income" ? "in" : "out";
  const now = nowText();
  await env.DB.prepare(
    `UPDATE third_party_funds
     SET account_id = ?1, contact_id = ?2, direction = ?3, amount = ?4, date = ?5, note = ?6,
         updated_at = ?7, sync_source = ?8
     WHERE id = ?9`
  )
    .bind(
      input.accountId,
      input.contactId,
      direction,
      input.amount,
      input.date,
      input.note ?? null,
      now,
      input.syncSource,
      existing.id
    )
    .run();

  return { thirdPartyFundIds: [existing.id], deletedThirdPartyFundIds: [] };
}

// Port PERSIS dari applyThirdPartyTransfer (desktop) -- pindah tempat
// dan/atau pindah kepemilikan, transfer ANTAR akun third_party (satu-
// satunya kombinasi valid, classifyAccountPair "third_party-third_party").
// Menghasilkan DUA baris independen per transaksi: satu 'out' di (akun
// sumber, kontak asal), satu 'in' di (akun tujuan, kontak tujuan).
// Validasi oversell dicek SEBELUM kedua insert (sisi keluar), caller
// (transactions/service.ts) WAJIB memanggil validateThirdPartyTransfer
// di bawah SEBELUM insert baris `transactions`, sama alasan atomicity
// dgn validateDirectThirdPartyTransaction.
export type ApplyThirdPartyTransferInput = {
  transactionId: string;
  sourceAccountId: string;
  sourceContactId: string;
  destinationAccountId: string;
  destinationContactId: string;
  amount: number;
  date: string;
  note?: string | null;
  syncSource: SyncSource;
};

export async function applyThirdPartyTransfer(
  env: Env,
  {
    transactionId,
    sourceAccountId,
    sourceContactId,
    destinationAccountId,
    destinationContactId,
    amount,
    date,
    note = null,
    syncSource,
  }: ApplyThirdPartyTransferInput
): Promise<TouchedThirdPartyFundRows> {
  const remaining = await getRemainingThirdPartyFund(env, sourceAccountId, sourceContactId);
  if (amount > remaining) {
    throw new InsufficientThirdPartyFundError(remaining, amount);
  }

  const outId = await insertThirdPartyFund(env, {
    accountId: sourceAccountId,
    contactId: sourceContactId,
    transactionId,
    direction: "out",
    amount,
    date,
    note,
    syncSource,
  });
  const inId = await insertThirdPartyFund(env, {
    accountId: destinationAccountId,
    contactId: destinationContactId,
    transactionId,
    direction: "in",
    amount,
    date,
    note,
    syncSource,
  });

  return { thirdPartyFundIds: [outId, inId], deletedThirdPartyFundIds: [] };
}

// Pre-check REJECT SEBELUM SIMPAN utk transfer third_party->third_party
// -- sejajar validateDirectThirdPartyTransaction, dipanggil dari
// transactions/service.ts SEBELUM insert/update baris `transactions`
// arah transfer. excludeSourceId dipakai jalur EDIT (unit baris LAMA
// dikompensasi dulu).
export async function validateThirdPartyTransfer(
  env: Env,
  { sourceAccountId, amount, excludeId }: { sourceAccountId: string; amount: number; excludeId?: string },
  sourceContactId: string
): Promise<ValidateThirdPartyResult> {
  const remaining = await getRemainingThirdPartyFund(env, sourceAccountId, sourceContactId, excludeId);
  if (amount > remaining) {
    return { status: "rejected", reason: new InsufficientThirdPartyFundError(remaining, amount).message };
  }
  return { status: "ok" };
}

type ExistingThirdPartyFundRow = {
  id: string;
  account_id: string;
  contact_id: string;
  direction: "in" | "out";
  amount: number;
};

async function getTransactionThirdPartyFundRows(env: Env, transactionId: string): Promise<ExistingThirdPartyFundRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, account_id, contact_id, direction, amount FROM third_party_funds WHERE transaction_id = ?1 AND deleted_at IS NULL"
  )
    .bind(transactionId)
    .all<ExistingThirdPartyFundRow>();
  return results;
}

// Port PERSIS dari detachThirdPartyFundsForDeletedTransaction (desktop)
// -- dipanggil dari transactions/service.ts deleteTransaction, TANPA
// guard syncSource (pola sama detachDebtForDeletedTransaction/
// detachInvestmentPurchaseForDeletedTransaction). BEDA dari desktop
// (hard-DELETE): Worker SOFT-delete (`deleted_at`) krn baris ini ikut
// sync -- 1 baris utk income/expense langsung, 2 baris utk transfer
// third_party->third_party (lihat applyThirdPartyTransfer).
export async function detachThirdPartyFundsForDeletedTransaction(
  env: Env,
  transactionId: string
): Promise<TouchedThirdPartyFundRows> {
  const rows = await getTransactionThirdPartyFundRows(env, transactionId);
  if (rows.length === 0) return none;

  const now = nowText();
  await env.DB.prepare("UPDATE third_party_funds SET deleted_at = ?1, updated_at = ?1 WHERE transaction_id = ?2")
    .bind(now, transactionId)
    .run();

  return { thirdPartyFundIds: [], deletedThirdPartyFundIds: rows.map((r) => r.id) };
}

export type PushResult = { status: "ok"; id: string } | { status: "stale" };

// Upsert-by-id MURNI utk baris third_party_funds yg desktop SUDAH buat
// sendiri (apply-third-party-transaction.ts lokal, baik jalur direct
// maupun transfer) -- pola PERSIS pushDebtFromPc/pushInvestmentPurchaseFromPc.
// Dipakai jg utk hasil EDIT lokal (nominal/tanggal/catatan baris titip/
// ambil langsung, lihat use-edit-third-party-fund.ts desktop) -- UPDATE
// in-place by id, tidak ada recreate.
export async function pushThirdPartyFundFromPc(
  env: Env,
  payload: PushThirdPartyFundPayload,
  syncSource: SyncSource
): Promise<PushResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM third_party_funds WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const now = nowText();
  if (existing) {
    await env.DB.prepare(
      `UPDATE third_party_funds
       SET account_id = ?1, contact_id = ?2, transaction_id = ?3, direction = ?4, amount = ?5, date = ?6, note = ?7,
           updated_at = ?8, deleted_at = NULL
       WHERE id = ?9`
    )
      .bind(
        payload.accountId,
        payload.contactId,
        payload.transactionId,
        payload.direction,
        payload.amount,
        payload.date,
        payload.note ?? null,
        decision.updatedAt,
        payload.id
      )
      .run();
    return { status: "ok", id: payload.id };
  }

  await env.DB.prepare(
    `INSERT INTO third_party_funds
       (id, account_id, contact_id, transaction_id, direction, amount, date, note, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
  )
    .bind(
      payload.id,
      payload.accountId,
      payload.contactId,
      payload.transactionId,
      payload.direction,
      payload.amount,
      payload.date,
      payload.note ?? null,
      now,
      decision.updatedAt,
      syncSource
    )
    .run();

  return { status: "ok", id: payload.id };
}

export type DeletePushedResult = { status: "ok" } | { status: "not_found" };

// Soft-delete murni utk baris third_party_funds yg PC hapus lokal --
// pola PERSIS deletePushedInvestmentPurchase. Dipakai desktop saat
// use-delete-transaction.ts/cleanup-stale-domain.ts hard-delete baris
// lokalnya (jalur hapus transaksi, BUKAN jalur ini di deleteTransaction
// Worker yang sudah menangani soft-delete server-side via
// detachThirdPartyFundsForDeletedTransaction -- endpoint ini khusus utk
// kasus PC sudah hard-delete baris lokal TANPA lewat deleteTransaction
// Worker, mis. race antar device).
export async function deletePushedThirdPartyFund(env: Env, id: string): Promise<DeletePushedResult> {
  const existing = await env.DB.prepare("SELECT id FROM third_party_funds WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = nowText();
  await env.DB.prepare("UPDATE third_party_funds SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}

// ============================================================
// Titip/ambil LANGSUNG dipicu dari MCP -- port PERSIS cabang
// record_mode='direct' di apps/desktop/src/features/third-party/content/data/form/
// use-create-third-party-fund.ts, pola PERSIS createDirectDebt
// (debts/service.ts) / createDirectInvestmentPurchase (investments/service.ts).
// Dipanggil LANGSUNG dari MCP tanpa harus lewat desktop -- Worker SENDIRI
// yang insert transaksi income/expense + baris third_party_funds,
// BUKAN jalur push (desktop tidak bisa membuat baris ini lebih dulu di
// sini). Tahap 4, docs/todos/plan/third-party-sync.md.
// ============================================================

export type CreateDirectThirdPartyFundResult =
  | { status: "ok"; id: string; transactionId: string }
  | { status: "stale" }
  | { status: "rejected"; reason: string };

export async function createDirectThirdPartyFund(
  env: Env,
  payload: CreateDirectThirdPartyFundPayload,
  syncSource: SyncSource
): Promise<CreateDirectThirdPartyFundResult> {
  const existing = await env.DB.prepare(
    "SELECT updated_at, transaction_id FROM third_party_funds WHERE id = ?1"
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
  if (accountType !== "third_party") {
    return {
      status: "rejected",
      reason: "Titip/ambil mode langsung wajib menunjuk ke akun bertipe 'third_party'.",
    };
  }

  const contactId = payload.contactId ?? (await resolveContactId(env, payload.contactName ?? null, syncSource));
  if (contactId == null) {
    return { status: "rejected", reason: "Kontak wajib diisi (contactId atau contactName)." };
  }

  // Idempotency MURNI (bukan edit) -- endpoint ini create-only dari MCP
  // (tidak ada jalur edit mode direct, sama pola createDirectInvestmentPurchase),
  // existing cuma relevan kalau permintaan yang sama dikirim ulang
  // (timeout, retry) -- baris LAMA tetap apa adanya, transactionId-nya
  // yang sudah tersimpan dikembalikan ulang.
  if (existing && existing.transaction_id != null) {
    return { status: "ok", id: payload.id, transactionId: existing.transaction_id };
  }

  // Validasi oversell SEBELUM insert apa pun -- sama alasan precheck di
  // transactions/service.ts (validateDirectThirdPartyTransaction): reject
  // SETELAH insert meninggalkan transaksi yatim tanpa third_party_funds
  // pasangannya.
  if (payload.direction === "out") {
    const remaining = await getRemainingThirdPartyFund(env, payload.accountId, contactId);
    if (payload.amount > remaining) {
      return { status: "rejected", reason: new InsufficientThirdPartyFundError(remaining, payload.amount).message };
    }
  }

  const now = nowText();
  const transactionId = uuidv7();
  const transactionType = payload.direction === "in" ? "income" : "expense";
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
        contact_id, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, NULL, ?4, NULL, ?5, ?6, NULL, ?7, ?8, ?8, ?9)`
  )
    .bind(transactionId, transactionType, payload.amount, payload.accountId, payload.note ?? null, payload.date, contactId, now, syncSource)
    .run();

  await env.DB.prepare(
    `INSERT INTO third_party_funds
       (id, account_id, contact_id, transaction_id, direction, amount, date, note, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10)`
  )
    .bind(
      payload.id,
      payload.accountId,
      contactId,
      transactionId,
      payload.direction,
      payload.amount,
      payload.date,
      payload.note ?? null,
      now,
      syncSource
    )
    .run();

  return { status: "ok", id: payload.id, transactionId };
}
