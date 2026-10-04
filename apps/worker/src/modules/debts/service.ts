import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import { classifyAccountPair, UnsupportedAccountPairError } from "./classify-account-pair";
import { resolveContactId } from "../contacts/service";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";
import type { CreateDirectDebtPayload, CreateNonCashPaymentPayload } from "./schema";

type OngoingDebtRow = { id: string; remaining: number };

export type ApplyDebtTransactionInput = {
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  // Hanya terisi untuk type === 'transfer'.
  transferAccountId: string | null;
  contactId: string | null;
  amount: number;
  date: string;
  // Hanya relevan saat arah transfer adalah debt->cash (ambigu antara
  // pelunasan piutang existing vs utang baru).
  debtAction: "settlement" | "payable" | null;
  // debts.id yang dipilih utk dilunasi -- cuma dipakai saat
  // debtAction === 'settlement'.
  settleDebtIds: string[];
  // Provenance utk baris debts/debt_payments yg di-insert di sini --
  // derive dari token request (shared/auth.ts), BUKAN dari payload client.
  syncSource: SyncSource;
};

export type ApplyDebtTransactionResult =
  | { status: "ok" }
  | { status: "rejected"; reason: string };

// Logic bisnis #3 dari mcp-server-business-logic-audit.md -- port dari
// use-transaction-debt-fields.ts/pay-debt-form.tsx, yg di desktop CUMA
// validasi UI (tidak diverifikasi ulang di settleDebtsFifo). DI SINI
// jadi VALIDASI KERAS (reject 422) SEBELUM alokasi apa pun dijalankan,
// konsisten dgn pola #4 -- bukan "alokasikan sebagian lalu beri tahu
// sisa gagal" (semua atau tidak sama sekali).
export class DebtSettlementExceedsRemainingError extends Error {}

// Logic bisnis #2 dari mcp-server-business-logic-audit.md, port dari
// apply-debt-transaction.ts (DebtEditBlockedError) -- dilempar kalau
// transaksi yg jadi PRINCIPAL sebuah piutang/utang diedit pada field
// berbahaya PADAHAL piutang itu sudah dicicil transaksi lain (recreate
// akan menghapus cicilan via CASCADE).
export class DebtEditBlockedError extends Error {
  constructor() {
    super(
      "Piutang/utang ini sudah menerima cicilan dari transaksi lain — nominal/akun/kontak tidak bisa diubah dari sini."
    );
  }
}

// Logic bisnis #7 (bagian status resolve) dari
// mcp-server-business-logic-audit.md, port dari
// use-transaction-debt-status.ts (useTransactionDebtStatus) -- versi
// Worker query D1 langsung, BUKAN dari cache React Query spt desktop.
export type TransactionDebtStatus =
  | { role: "none" }
  | { role: "principal"; debtId: string; hasPayments: boolean }
  | { role: "payment"; debtPaymentId: string; debtId: string };

// Pre-check logic #3 -- dipanggil SEBELUM insert/update baris
// `transactions`, supaya reject terjadi sebelum ada tulisan apa pun
// (hindari baris transaksi tersimpan sementara FIFO settlement-nya
// ditolak, lihat catatan atomicity di transactions/service.ts).
// settleDebtsFifo TETAP divalidasi ulang di dalam dirinya sendiri
// sbg defense-in-depth (dipanggil dari 2 jalur: create & edit).
export async function validateDebtSettlementAmount(
  env: Env,
  { amount, settleDebtIds }: { amount: number; settleDebtIds: string[] }
): Promise<ApplyDebtTransactionResult> {
  if (settleDebtIds.length === 0) return { status: "ok" };

  const placeholders = settleDebtIds.map((_, i) => `?${i + 1}`).join(", ");
  const { results: debts } = await env.DB.prepare(
    `SELECT
       debts.id,
       debts.amount - COALESCE(
         (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
         0
       ) AS remaining
     FROM debts
     WHERE debts.id IN (${placeholders}) AND debts.deleted_at IS NULL`
  )
    .bind(...settleDebtIds)
    .all<OngoingDebtRow>();

  const totalRemaining = debts.reduce((sum, debt) => sum + debt.remaining, 0);
  if (amount > totalRemaining) {
    return {
      status: "rejected",
      reason: "Nominal pelunasan melebihi total sisa piutang/utang yang dipilih.",
    };
  }
  return { status: "ok" };
}

// Pre-check REJECT SEBELUM SIMPAN (lihat
// audit-kepatuhan-konsep-tipe-akun.md pertanyaan #4) -- dipanggil dari
// transactions/service.ts SEBELUM insert/update baris `transactions`,
// sama pola dgn validateDebtSettlementAmount di atas. Kombinasi tipe
// akun di luar cash/debt (misal investment, kalau sudah ditambahkan
// nanti) WAJIB ditolak di sini dulu -- applyDebtTransaction di bawah
// cuma jadi safety net (sudah terlambat utk reject-sebelum-simpan kalau
// baru ketahuan di situ).
export async function validateAccountPairSupported(
  env: Env,
  { type, accountId, transferAccountId }: Pick<ApplyDebtTransactionInput, "type" | "accountId" | "transferAccountId">
): Promise<ApplyDebtTransactionResult> {
  if (type !== "transfer" || transferAccountId == null) return { status: "ok" };

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(env, accountId),
    getAccountType(env, transferAccountId),
  ]);
  if (sourceType == null || destinationType == null) {
    return { status: "rejected", reason: "Akun sumber/tujuan transfer tidak ditemukan." };
  }

  try {
    classifyAccountPair(sourceType, destinationType);
    return { status: "ok" };
  } catch (err) {
    if (err instanceof UnsupportedAccountPairError) {
      return { status: "rejected", reason: err.message };
    }
    throw err;
  }
}

export async function getTransactionDebtStatus(
  env: Env,
  transactionId: string
): Promise<TransactionDebtStatus> {
  const asPrincipal = await env.DB.prepare(
    "SELECT id FROM debts WHERE transaction_id = ?1 AND deleted_at IS NULL LIMIT 1"
  )
    .bind(transactionId)
    .first<{ id: string }>();

  if (asPrincipal) {
    const payments = await env.DB.prepare(
      "SELECT EXISTS(SELECT 1 FROM debt_payments WHERE debt_id = ?1) AS found"
    )
      .bind(asPrincipal.id)
      .first<{ found: number }>();
    return { role: "principal", debtId: asPrincipal.id, hasPayments: payments?.found === 1 };
  }

  const asPayment = await env.DB.prepare(
    "SELECT id, debt_id FROM debt_payments WHERE transaction_id = ?1 LIMIT 1"
  )
    .bind(transactionId)
    .first<{ id: string; debt_id: string }>();

  if (asPayment) {
    return { role: "payment", debtPaymentId: asPayment.id, debtId: asPayment.debt_id };
  }

  return { role: "none" };
}

async function getAccountType(env: Env, accountId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT account_type FROM accounts WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(accountId)
    .first<{ account_type: string }>();
  return row?.account_type ?? null;
}

// Logic bisnis #1 dari mcp-server-business-logic-audit.md, port PERSIS
// dari apps/desktop/src/shared/debts/apply-debt-transaction.ts
// (applyDebtTransaction). Setelah baris `transactions` tersimpan,
// deteksi apakah transfer ini melibatkan akun `account_type='debt'`
// dan buat/update `debts`/`debt_payments` sesuai arah:
// - cash -> debt: piutang baru (type='receivable').
// - debt -> cash: WAJIB `debtAction` eksplisit -- 'payable' (utang
//   baru) atau 'settlement' (lunasi piutang existing, FIFO).
// - debt -> debt / cash -> cash: no-op (di luar scope).
//
// BEDA dari desktop: modul ini adalah PEMILIK logic (dipanggil dari
// transactions/service.ts sbg PEMICU, lihat
// apps/worker/docs/rules/module-structure.md "Logic bisnis lintas-modul").
export async function applyDebtTransaction(
  env: Env,
  input: ApplyDebtTransactionInput
): Promise<ApplyDebtTransactionResult> {
  const {
    transactionId,
    type,
    accountId,
    transferAccountId,
    contactId,
    amount,
    date,
    debtAction,
    settleDebtIds,
    syncSource,
  } = input;

  if (type !== "transfer" || transferAccountId == null) return { status: "ok" };

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(env, accountId),
    getAccountType(env, transferAccountId),
  ]);
  if (sourceType == null || destinationType == null) {
    return { status: "rejected", reason: "Akun sumber/tujuan transfer tidak ditemukan." };
  }

  // Sudah dicegat lebih dulu oleh validateAccountPairSupported (dipanggil
  // SEBELUM insert/update transaksi di transactions/service.ts) -- throw
  // di sini murni safety net, seharusnya tidak pernah tercapai.
  const pairKind = classifyAccountPair(sourceType, destinationType);

  if (pairKind === "cash-cash" || pairKind === "debt-debt") {
    // "kas -> kas" (bukan urusan debt) ATAU "debt -> debt" (di luar
    // scope) -- tidak melakukan apa-apa.
    return { status: "ok" };
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (pairKind === "cash-debt") {
    // Kas -> Debt: piutang baru, tidak ambigu.
    await env.DB.prepare(
      `INSERT INTO debts
         (id, type, contact_id, amount, account_id, transaction_id, date, created_at, updated_at, sync_source)
       VALUES (?1, 'receivable', ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)`
    )
      .bind(uuidv7(), contactId, amount, transferAccountId, transactionId, date, now, syncSource)
      .run();
    return { status: "ok" };
  }

  // pairKind === "debt-cash" (satu-satunya variant tersisa): butuh
  // keputusan eksplisit dari caller.
  if (debtAction === "payable") {
    await env.DB.prepare(
      `INSERT INTO debts
         (id, type, contact_id, amount, account_id, transaction_id, date, created_at, updated_at, sync_source)
       VALUES (?1, 'payable', ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)`
    )
      .bind(uuidv7(), contactId, amount, accountId, transactionId, date, now, syncSource)
      .run();
    return { status: "ok" };
  }

  if (debtAction === "settlement") {
    try {
      await settleDebtsFifo(env, { transactionId, accountId, amount, date, settleDebtIds, syncSource });
    } catch (err) {
      if (err instanceof DebtSettlementExceedsRemainingError) {
        return {
          status: "rejected",
          reason: "Nominal pelunasan melebihi total sisa piutang/utang yang dipilih.",
        };
      }
      throw err;
    }
  }

  return { status: "ok" };
}

async function settleDebtsFifo(
  env: Env,
  {
    transactionId,
    accountId,
    amount,
    date,
    settleDebtIds,
    syncSource,
  }: {
    transactionId: string;
    accountId: string;
    amount: number;
    date: string;
    settleDebtIds: string[];
    syncSource: SyncSource;
  }
): Promise<void> {
  if (settleDebtIds.length === 0) return;

  const placeholders = settleDebtIds.map((_, i) => `?${i + 1}`).join(", ");
  const { results: debts } = await env.DB.prepare(
    `SELECT
       debts.id,
       debts.amount - COALESCE(
         (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
         0
       ) AS remaining
     FROM debts
     WHERE debts.id IN (${placeholders}) AND debts.deleted_at IS NULL
     ORDER BY debts.date ASC, debts.id ASC`
  )
    .bind(...settleDebtIds)
    .all<OngoingDebtRow>();

  // Logic #3: tolak SELURUH alokasi (bukan alokasi sebagian) kalau
  // nominal pelunasan melebihi total sisa piutang/utang yang dipilih --
  // lihat komentar DebtSettlementExceedsRemainingError di atas.
  const totalRemaining = debts.reduce((sum, debt) => sum + debt.remaining, 0);
  if (amount > totalRemaining) {
    throw new DebtSettlementExceedsRemainingError();
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  let remainingToAllocate = amount;
  for (const debt of debts) {
    if (remainingToAllocate <= 0) break;
    const allocation = Math.min(debt.remaining, remainingToAllocate);
    if (allocation <= 0) continue;

    await env.DB.prepare(
      `INSERT INTO debt_payments
         (id, debt_id, amount, account_id, transaction_id, date, created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)`
    )
      .bind(uuidv7(), debt.id, allocation, accountId, transactionId, date, now, syncSource)
      .run();

    if (allocation >= debt.remaining) {
      await env.DB.prepare("UPDATE debts SET status = 'paid' WHERE id = ?1").bind(debt.id).run();
    }

    remainingToAllocate -= allocation;
  }
}

// Logic bisnis #2 dari mcp-server-business-logic-audit.md, port PERSIS
// dari apply-debt-transaction.ts (applyDebtTransactionEdit) -- versi
// EDIT dari applyDebtTransaction di atas, dipanggil dari
// transactions/service.ts (modul PEMICU) setelah UPDATE baris
// `transactions` berhasil:
// - role 'none': sama seperti create, langsung applyDebtTransaction.
// - role 'principal' + field berbahaya TIDAK berubah: sinkronkan
//   debts.date saja.
// - role 'principal' + field berbahaya berubah + hasPayments: BLOKIR
//   (DebtEditBlockedError) -- recreate akan menghapus cicilan via
//   CASCADE.
// - role 'principal' + field berbahaya berubah + belum ada cicilan:
//   hapus debts lama, applyDebtTransaction dari nilai baru.
// - role 'payment' + field berbahaya TIDAK berubah: sinkronkan
//   debt_payments.date saja.
// - role 'payment' + field berbahaya berubah: SELALU aman recreate --
//   hapus debt_payments lama, revert debts.status ke 'ongoing' kalau
//   sempat 'paid' krn pembayaran ini, lalu applyDebtTransaction dari
//   nilai baru.
export async function applyDebtTransactionEdit(
  env: Env,
  input: ApplyDebtTransactionInput & { status: TransactionDebtStatus; dangerousFieldsChanged: boolean }
): Promise<ApplyDebtTransactionResult> {
  const { status, dangerousFieldsChanged, ...rest } = input;
  const { date } = rest;

  if (status.role === "none") {
    return applyDebtTransaction(env, rest);
  }

  if (status.role === "principal") {
    if (!dangerousFieldsChanged) {
      await env.DB.prepare("UPDATE debts SET date = ?1 WHERE id = ?2").bind(date, status.debtId).run();
      return { status: "ok" };
    }
    if (status.hasPayments) {
      throw new DebtEditBlockedError();
    }
    await env.DB.prepare("DELETE FROM debts WHERE id = ?1").bind(status.debtId).run();
    return applyDebtTransaction(env, rest);
  }

  // status.role === "payment"
  if (!dangerousFieldsChanged) {
    await env.DB.prepare("UPDATE debt_payments SET date = ?1 WHERE id = ?2")
      .bind(date, status.debtPaymentId)
      .run();
    return { status: "ok" };
  }

  await env.DB.prepare("DELETE FROM debt_payments WHERE id = ?1").bind(status.debtPaymentId).run();
  // Piutang induknya mungkin sempat ditandai 'paid' krn pembayaran yang
  // baru saja dihapus ini -- kalau sekarang ternyata masih ada sisa,
  // kembalikan ke 'ongoing' supaya tidak "hilang" dari daftar berjalan.
  await env.DB.prepare(
    `UPDATE debts SET status = 'ongoing'
     WHERE id = ?1 AND status = 'paid' AND amount > COALESCE(
       (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
       0
     )`
  )
    .bind(status.debtId)
    .run();
  return applyDebtTransaction(env, rest);
}

// Info piutang/utang terkait transaksi yg mau dihapus, dibalikin ke
// caller (transactions/service.ts) spy response DELETE bisa kasih tau
// client APA yg terjadi -- dialog PC pakai ini utk pesan spesifik
// SETELAH delete berhasil (bukan "cek dulu baru hapus" dua jalur,
// lihat keputusan di cloud-sync.md "DELETE /transactions/:id").
export type DeletedTransactionDebtInfo =
  | { role: "none" }
  | { role: "payment"; debtId: string }
  | { role: "principal"; debtId: string; hadPayments: boolean };

// Dipanggil dari transactions/service.ts SETELAH baris `transactions`
// di-soft-delete. Tindakan TUNGGAL per role (TIDAK ada pilihan client,
// beda dari deleteAccount yg py transactionAction opsional) -- piutang/
// cicilan itu sendiri TIDAK PERNAH dihapus di sini, cuma jejak
// transaction_id-nya yg dilepas/disesuaikan:
// - role 'none': no-op.
// - role 'payment': SAMA PERSIS logic revert di applyDebtTransactionEdit
//   (role='payment', dangerousFieldsChanged) -- hapus debt_payments,
//   revert debts.status ke 'ongoing' kalau sempat 'paid'. BEDA dari
//   edit: di sini TIDAK ada applyDebtTransaction lagi sesudahnya
//   (transaksinya sudah dihapus, tidak ada transfer baru utk dibuat).
// - role 'principal': debts.transaction_id SET NULL (BUKAN DELETE
//   debts) -- piutang/cicilan tetap utuh scr nominal (dihitung dari
//   debts.amount - SUM(debt_payments), independen dari transaction_id),
//   cuma kehilangan jejak transaksi ASAL. Aman baik sudah/belum dicicil
//   (keputusan 2026-10-03, lihat cloud-sync.md).
export async function detachDebtForDeletedTransaction(
  env: Env,
  transactionId: string
): Promise<DeletedTransactionDebtInfo> {
  const status = await getTransactionDebtStatus(env, transactionId);

  if (status.role === "none") {
    return { role: "none" };
  }

  if (status.role === "payment") {
    await env.DB.prepare("DELETE FROM debt_payments WHERE id = ?1").bind(status.debtPaymentId).run();
    await env.DB.prepare(
      `UPDATE debts SET status = 'ongoing'
       WHERE id = ?1 AND status = 'paid' AND amount > COALESCE(
         (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
         0
       )`
    )
      .bind(status.debtId)
      .run();
    return { role: "payment", debtId: status.debtId };
  }

  // status.role === "principal"
  await env.DB.prepare("UPDATE debts SET transaction_id = NULL WHERE id = ?1").bind(status.debtId).run();
  return { role: "principal", debtId: status.debtId, hadPayments: status.hasPayments };
}

export type CreateDirectDebtResult =
  | { status: "ok"; id: string }
  | { status: "stale" }
  | { status: "rejected"; reason: string };

// Port dari new-debt-form/use-create-debt.ts (record_mode === 'direct') --
// lihat audit-kepatuhan-konsep-tipe-akun.md pertanyaan #7 (paralelitas
// desktop vs Worker/MCP, gap ditutup 2026-10-03). account_id WAJIB akun
// bertipe 'debt' (prinsip #1 konsep-tipe-akun.md). Mode 'transfer' SUDAH
// bisa lewat insertTransaction (transactions/service.ts) + debtAction --
// TIDAK diulang di sini.
//
// CATATAN KOREKSI (2026-10-04): versi SEBELUMNYA fungsi ini SELALU
// transaction_id:NULL (tanpa transaksi apa pun), mereplikasi bug yang
// sama dengan createNonCashPayment/writeOffDebt SEBELUM diperbaiki --
// saldo akun debt tidak pernah ikut bertambah/berkurang padahal piutang/
// utangnya tercatat. Ditemukan telat (fix createNonCashPayment/
// writeOffDebt di hari yang sama sempat tidak ikut menyentuh fungsi ini).
// Sekarang reuse createDebtClosingTransaction yang sama, arah tanda
// KEBALIKAN dari closing (closing membawa ke nol, ini MENCIPTAKAN
// piutang/utang baru): receivable -> income (+), payable -> expense (-)
// pada akun debt itu sendiri -- lihat docs/concept/konsep-utang-piutang.md.
// Transaksi penutup HANYA dibuat saat INSERT baris baru (bukan saat
// UPDATE existing lewat LWW retry) -- transaksinya sudah dibuat sekali
// saat insert pertama, UPDATE di sini cuma menyesuaikan field non-transaksi
// (idempotent, tidak menyentuh/reset transaction_id).
export async function createDirectDebt(
  env: Env,
  payload: CreateDirectDebtPayload,
  syncSource: SyncSource
): Promise<CreateDirectDebtResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM debts WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const accountType = await getAccountType(env, payload.accountId);
  if (accountType == null) {
    return { status: "rejected", reason: "Akun tidak ditemukan." };
  }
  if (accountType !== "debt") {
    return {
      status: "rejected",
      reason: "Piutang/utang mode langsung wajib menunjuk ke akun bertipe 'debt'.",
    };
  }

  const resolvedContactId = payload.contactId ?? (await resolveContactId(env, payload.contactName ?? null, syncSource));

  if (existing) {
    await env.DB.prepare(
      `UPDATE debts
       SET type = ?1, contact_id = ?2, amount = ?3, account_id = ?4, date = ?5, note = ?6,
           updated_at = ?7, deleted_at = NULL
       WHERE id = ?8`
    )
      .bind(
        payload.type,
        resolvedContactId,
        payload.amount,
        payload.accountId,
        payload.date,
        payload.note ?? null,
        decision.updatedAt,
        payload.id
      )
      .run();
    return { status: "ok", id: payload.id };
  }

  const transactionId = await createDebtClosingTransaction(env, {
    debt: { type: payload.type, contact_id: resolvedContactId, account_id: payload.accountId },
    amount: payload.amount,
    date: payload.date,
    note: payload.note ?? null,
    syncSource,
    closingDirection: "create",
  });

  const now = nowText();
  await env.DB.prepare(
    `INSERT INTO debts
       (id, type, contact_id, amount, account_id, transaction_id, date, note, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
  )
    .bind(
      payload.id,
      payload.type,
      resolvedContactId,
      payload.amount,
      payload.accountId,
      transactionId,
      payload.date,
      payload.note ?? null,
      now,
      decision.updatedAt,
      syncSource
    )
    .run();

  return { status: "ok", id: payload.id };
}

type DebtForClosingRow = {
  type: "receivable" | "payable";
  contact_id: string | null;
  account_id: string | null;
};

// Transaksi "penutup"/"pembuka" LANGSUNG pada akun debt itu sendiri --
// TIDAK ada uang riil berpindah ke akun kas mana pun, tapi TETAP wajib
// lewat `transactions` (satu-satunya jalur sah mengubah accounts.balance,
// lihat docs/concept/konsep-transaksi.md "Kenapa prinsip ini sempat
// dilanggar, dan kenapa itu salah") supaya saldo akun debt ikut berubah.
// Dua arah (`closingDirection`), KEBALIKAN satu sama lain:
// - 'close' (default pelunasan/write-off): membawa saldo MENUJU NOL.
//   receivable -> expense (-), payable -> income (+). Port PERSIS dari
//   pay-debt-form/use-pay-debt.ts (cabang non_cash) & use-write-off-debt.ts.
// - 'create' (piutang/utang BARU, record_mode='direct'): MENCIPTAKAN
//   nilai baru yang "dipegang" akun debt. receivable -> income (+),
//   payable -> expense (-). Port dari new-debt-form/use-create-debt.ts.
// Dipanggil SETELAH caller memastikan `debt.account_id` tidak null
// (satu-satunya kasus tanpa transaksi penutup/pembuka adalah baris sync
// Retailku, lihat komentar di use-pay-debt.ts).
async function createDebtClosingTransaction(
  env: Env,
  {
    debt,
    amount,
    date,
    note,
    syncSource,
    closingDirection = "close",
  }: {
    debt: DebtForClosingRow & { account_id: string };
    amount: number;
    date: string;
    note: string | null;
    syncSource: SyncSource;
    closingDirection?: "close" | "create";
  }
): Promise<string> {
  const transactionId = uuidv7();
  const isReceivable = debt.type === "receivable";
  const transactionType: "income" | "expense" =
    closingDirection === "close"
      ? isReceivable
        ? "expense"
        : "income"
      : isReceivable
        ? "income"
        : "expense";
  const now = nowText();

  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id, note, date, description, contact_id,
        created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, NULL, ?4, NULL, ?5, ?6, NULL, ?7, ?8, ?8, ?9)`
  )
    .bind(transactionId, transactionType, amount, debt.account_id, note, date, debt.contact_id, now, syncSource)
    .run();

  return transactionId;
}

export type CreateNonCashPaymentResult =
  | { status: "ok"; id: string }
  | { status: "stale" }
  | { status: "not_found" }
  | { status: "rejected"; reason: string };

// Port dari pay-debt-form/use-pay-debt.ts (settlement_mode === 'non_cash')
// -- pelunasan TANPA uang berpindah sama sekali (barter/pemutihan/offset).
// account_id ikut debts.account_id (akun bertipe 'debt' milik baris ini).
// Settlement 'cash' SUDAH bisa lewat insertTransaction + debtAction=settlement
// -- TIDAK diulang di sini.
//
// CATATAN KOREKSI (2026-10-04): versi SEBELUMNYA fungsi ini SELALU
// transaction_id:NULL, mereplikasi pola LAMA desktop yang sudah terbukti
// salah (lihat docs/concept/konsep-transaksi.md) -- saldo akun debt tidak
// pernah berkurang via jalur ini. Sekarang PERSIS niru use-pay-debt.ts
// revisi: ada transaksi penutup kalau account_id terisi, transaction_id
// NULL cuma tersisa utk baris dari sync Retailku (account_id NULL).
export async function createNonCashPayment(
  env: Env,
  debtId: string,
  payload: CreateNonCashPaymentPayload,
  syncSource: SyncSource
): Promise<CreateNonCashPaymentResult> {
  const debt = await env.DB.prepare(
    "SELECT type, contact_id, account_id, amount FROM debts WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(debtId)
    .first<DebtForClosingRow & { amount: number }>();
  if (!debt) return { status: "not_found" };

  const existing = await env.DB.prepare("SELECT updated_at FROM debt_payments WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();
  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const { results: payments } = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS paid FROM debt_payments WHERE debt_id = ?1 AND deleted_at IS NULL AND id <> ?2"
  )
    .bind(debtId, payload.id)
    .all<{ paid: number }>();
  const alreadyPaid = payments[0]?.paid ?? 0;
  const remaining = debt.amount - alreadyPaid;
  if (payload.amount > remaining) {
    return {
      status: "rejected",
      reason: "Nominal pelunasan melebihi sisa piutang/utang.",
    };
  }

  const transactionId =
    debt.account_id != null
      ? await createDebtClosingTransaction(env, {
          debt: { ...debt, account_id: debt.account_id },
          amount: payload.amount,
          date: payload.date,
          note: payload.note ?? null,
          syncSource,
        })
      : null;

  const now = nowText();
  if (existing) {
    await env.DB.prepare(
      "UPDATE debt_payments SET amount = ?1, date = ?2, note = ?3, updated_at = ?4, deleted_at = NULL WHERE id = ?5"
    )
      .bind(payload.amount, payload.date, payload.note ?? null, decision.updatedAt, payload.id)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date, note, created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
      .bind(
        payload.id,
        debtId,
        payload.amount,
        debt.account_id,
        transactionId,
        payload.date,
        payload.note ?? null,
        now,
        decision.updatedAt,
        syncSource
      )
      .run();
  }

  if (payload.amount >= remaining) {
    await env.DB.prepare("UPDATE debts SET status = 'paid' WHERE id = ?1").bind(debtId).run();
  }

  return { status: "ok", id: payload.id };
}

export type WriteOffDebtResult =
  | { status: "ok"; transactionId: string | null }
  | { status: "not_found" }
  | { status: "rejected"; reason: string };

// Port PERSIS dari use-write-off-debt.ts -- tandai piutang/utang
// `status='written_off'` (diikhlaskan, BUKAN pelunasan penuh biasa).
// Reuse createDebtClosingTransaction (logic identik dgn cabang non_cash
// di createNonCashPayment) -- transaksi penutup WAJIB dibuat sebesar
// sisa, supaya saldo akun debt ikut ke nol.
//
// BEDA dari createNonCashPayment: account_id NULL (baris sync Retailku)
// di SINI direject KERAS (422), BUKAN diam-diam skip transaksi penutup
// -- desktop (use-write-off-debt.ts baris 31-35) throw Error eksplisit
// utk kasus ini, jadi PERSIS diikuti di sini, BUKAN disamakan dgn
// keputusan createNonCashPayment yg sengaja mengizinkan tanpa transaksi.
export async function writeOffDebt(
  env: Env,
  debtId: string,
  syncSource: SyncSource
): Promise<WriteOffDebtResult> {
  const debt = await env.DB.prepare(
    "SELECT type, contact_id, account_id, amount FROM debts WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(debtId)
    .first<DebtForClosingRow & { amount: number }>();
  if (!debt) return { status: "not_found" };

  if (debt.account_id == null) {
    return {
      status: "rejected",
      reason: "Piutang/utang dari sinkronisasi Retailku belum bisa dihapuskan dari sini.",
    };
  }

  const { results: payments } = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS paid FROM debt_payments WHERE debt_id = ?1 AND deleted_at IS NULL"
  )
    .bind(debtId)
    .all<{ paid: number }>();
  const remaining = debt.amount - (payments[0]?.paid ?? 0);

  // No-op kalau sudah lunas/habis, PERSIS use-write-off-debt.ts baris 36
  // (bukan reject -- caller mungkin memanggil ulang tanpa tahu status
  // terbaru, biarkan idempotent).
  if (remaining <= 0) {
    await env.DB.prepare("UPDATE debts SET status = 'written_off' WHERE id = ?1").bind(debtId).run();
    return { status: "ok", transactionId: null };
  }

  const now = nowText();
  const transactionId = await createDebtClosingTransaction(env, {
    debt: { ...debt, account_id: debt.account_id },
    amount: remaining,
    date: now,
    note: "Penutup piutang/utang dihapuskan",
    syncSource,
  });

  await env.DB.prepare(
    `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?6, ?7)`
  )
    .bind(uuidv7(), debtId, remaining, debt.account_id, transactionId, now, syncSource)
    .run();

  await env.DB.prepare("UPDATE debts SET status = 'written_off' WHERE id = ?1").bind(debtId).run();

  return { status: "ok", transactionId };
}
