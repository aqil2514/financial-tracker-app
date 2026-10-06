import { getDb, type Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { classifyAccountPair } from "./classify-account-pair";
import { getTransactionDebtStatus, type TransactionDebtStatus } from "./use-transaction-debt-status";
import { remainingDebtSql } from "./remaining-debt-sql";

type Db = Awaited<ReturnType<typeof getDb>>;

type OngoingDebtRow = { id: string; remaining: number };

export type ApplyDebtTransactionInput = {
  db: Db;
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  /** Hanya terisi untuk `type === 'transfer'`. */
  transferAccountId: string | null;
  contactId: string | null;
  amount: number;
  date: string;
  /** Hanya relevan saat arah transfer adalah debt->cash (ambigu antara
   * pelunasan piutang existing vs utang baru) — lihat
   * "Deteksi otomatis debts dari transfer" di debt-receivable-tracking.md. */
  debtAction: "settlement" | "payable" | null;
  /** debts.id (string, dari form) yang dipilih untuk dilunasi — cuma
   * dipakai saat debtAction === 'settlement'. */
  settleDebtIds: string[];
};

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

// Id baris `debts`/`debt_payments` yang DISENTUH (dibuat ATAU di-UPDATE,
// mis. `status` jadi 'paid') oleh satu panggilan applyDebtTransaction/
// applyDebtTransactionEdit -- dipakai caller (use-create-transaction.ts
// dkk) utk tahu PERSIS apa yang perlu di-pushOnWrite ke Worker, krn
// fungsi di sini tidak lagi satu-satunya penulis D1 (lihat
// docs/todos/plan/fix-debts-duplikasi-sync.md, source-based ownership).
// Baris yang CUMA di-update statusnya (bukan dibuat baru) TETAP masuk
// supaya Worker dapat state terbaru, bukan cuma insert pertama.
//
// `deletedDebtIds`/`deletedDebtPaymentIds`: id baris yang di-HARD-DELETE
// lokal sbg bagian dari RECREATE (field berbahaya berubah, applyDebt-
// TransactionEdit hapus baris lama lalu insert baru dgn id BARU) --
// caller WAJIB pushDeleteOnWrite utk id ini, krn /debts/push di Worker
// cuma upsert-by-id dan TIDAK PERNAH tahu id lama harus dihapus kalau
// cuma mengandalkan push baris baru (gap ditemukan 2026-10-05 lewat
// test manual: baris lama menumpuk selamanya di D1 tanpa ini).
export type TouchedDebtRows = {
  debtIds: string[];
  debtPaymentIds: string[];
  deletedDebtIds: string[];
  deletedDebtPaymentIds: string[];
};

function mergeTouchedDebtRows(a: TouchedDebtRows, b: TouchedDebtRows): TouchedDebtRows {
  return {
    debtIds: [...a.debtIds, ...b.debtIds],
    debtPaymentIds: [...a.debtPaymentIds, ...b.debtPaymentIds],
    deletedDebtIds: [...a.deletedDebtIds, ...b.deletedDebtIds],
    deletedDebtPaymentIds: [...a.deletedDebtPaymentIds, ...b.deletedDebtPaymentIds],
  };
}

/**
 * Setelah transaksi transfer tersimpan, deteksi apakah transfer ini
 * melibatkan akun `account_type='debt'` dan, kalau ya, buat/update baris
 * `debts`/`debt_payments` yang sesuai — mengikuti aturan arah di
 * "Deteksi otomatis debts dari transfer" (debt-receivable-tracking.md):
 *
 * - cash -> debt: piutang baru (`type='receivable'`).
 * - debt -> cash: SELALU butuh `debtAction` eksplisit dari form —
 *   'payable' (utang baru) atau 'settlement' (lunasi piutang existing,
 *   FIFO berdasar `settleDebtIds`).
 * - debt -> debt: tidak melakukan apa-apa (di luar scope, lihat dok).
 * - kombinasi lain (melibatkan tipe akun ketiga spt investment, kalau
 *   sudah ditambahkan nanti): classifyAccountPair throw, lihat
 *   classify-account-pair.ts.
 *
 * Dipanggil SETELAH insert/update baris `transactions` selesai (butuh
 * `transactionId` untuk jejak `debts.transaction_id`/
 * `debt_payments.transaction_id`), sebelum mutation dianggap selesai —
 * bukan best-effort seperti lampiran, karena ini bagian inti pencatatan
 * finansial.
 */
export async function applyDebtTransaction({
  db,
  transactionId,
  type,
  accountId,
  transferAccountId,
  contactId,
  amount,
  date,
  debtAction,
  settleDebtIds,
}: ApplyDebtTransactionInput): Promise<TouchedDebtRows> {
  const none: TouchedDebtRows = { debtIds: [], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  if (type !== "transfer" || transferAccountId == null) return none;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  // null berarti akun sudah terhapus di antara submit form dan titik ini
  // (race, bukan tipe akun baru) -- beda kasus dari UnsupportedAccountPairError.
  if (sourceType == null || destinationType == null) {
    throw new Error("Akun sumber/tujuan transfer tidak ditemukan.");
  }

  // classifyAccountPair throw UnsupportedAccountPairError utk kombinasi
  // di luar cash/debt (lihat classify-account-pair.ts) -- seharusnya
  // sudah dicegat lebih dulu oleh validasi form
  // (use-transaction-debt-fields.ts), ini safety net.
  const pairKind = classifyAccountPair(sourceType, destinationType);

  if (pairKind === "cash-cash" || pairKind === "debt-debt" || pairKind === "cash-investment") {
    // "kas -> kas" (bukan urusan debt), "debt -> debt" (di luar scope),
    // maupun "cash -> investment" (urusan applyInvestmentTransaction,
    // lihat apply-investment-transaction.ts) — tidak melakukan apa-apa
    // di sini.
    return none;
  }

  if (pairKind === "cash-debt") {
    // Kas -> Debt: piutang baru, tidak ambigu.
    const id = newId();
    await db.execute(
      `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date)
       VALUES ($1, 'receivable', $2, $3, $4, $5, $6)`,
      [id, contactId, amount, transferAccountId, transactionId, date]
    );
    return { debtIds: [id], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  }

  // pairKind === "debt-cash": butuh keputusan eksplisit dari form.
  if (debtAction === "payable") {
    const id = newId();
    await db.execute(
      `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date)
       VALUES ($1, 'payable', $2, $3, $4, $5, $6)`,
      [id, contactId, amount, accountId, transactionId, date]
    );
    return { debtIds: [id], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  }

  if (debtAction === "settlement") {
    return settleDebtsFifo({ db, transactionId, accountId, amount, date, settleDebtIds });
  }

  return none;
}

export type ApplyDebtTransactionEditInput = ApplyDebtTransactionInput & {
  status: TransactionDebtStatus;
  /** true kalau salah satu dari amount/type/account_id/transfer_account_id/
   * contact_name/debt_action/settle_debt_ids berubah dari nilai semula —
   * dihitung di caller (use-update-transaction.ts) karena butuh
   * membandingkan dengan nilai LAMA transaksi, bukan sesuatu yang bisa
   * diketahui di sini. */
  dangerousFieldsChanged: boolean;
};

/**
 * Error kontrol alir spesifik untuk kasus yang HARUS diblokir di UI
 * (lihat "Edit transaksi yang sudah py debts terkait" di
 * debt-receivable-tracking.md) — kalau ini benar-benar terlempar sampai
 * ke user, berarti validasi di transaction-form.tsx gagal mencegahnya
 * duluan (safety net, bukan jalur utama).
 */
export class DebtEditBlockedError extends Error {
  constructor() {
    super(
      "Piutang ini sudah menerima cicilan dari transaksi lain — nominal/akun/kontak tidak bisa diubah dari sini."
    );
    this.name = "DebtEditBlockedError";
  }
}

/**
 * Versi `applyDebtTransaction` untuk jalur EDIT transaksi — lihat
 * keputusan lengkap di "Edit transaksi yang sudah py debts terkait"
 * (debt-receivable-tracking.md):
 *
 * - `status.role === 'none'` (belum pernah trigger apa pun): sama
 *   seperti create, langsung `applyDebtTransaction`.
 * - `status.role === 'principal'` (transaksi ini MEMBUAT sebuah
 *   `debts`) DAN field berbahaya TIDAK berubah: cuma sinkronkan
 *   `debts.date` kalau tanggal berubah — tidak perlu recreate.
 * - `principal` DAN field berbahaya berubah DAN `hasPayments` (piutang
 *   itu sudah dicicil transaksi LAIN): BLOKIR (`DebtEditBlockedError`)
 *   — recreate akan menghapus cicilan itu lewat CASCADE.
 * - `principal` DAN field berbahaya berubah DAN belum ada cicilan sama
 *   sekali: aman untuk recreate — hapus `debts` lama, jalankan
 *   `applyDebtTransaction` dari nilai baru seperti create.
 * - `status.role === 'payment'` (transaksi ini adalah SATU
 *   cicilan/pelunasan) DAN field berbahaya TIDAK berubah: sinkronkan
 *   `debt_payments.date` saja.
 * - `payment` DAN field berbahaya berubah: SELALU aman untuk recreate
 *   (tidak ada yang bergantung pada satu baris `debt_payments`) — hapus
 *   baris itu, revert `debts.status` ke `'ongoing'` kalau piutangnya
 *   sempat `'paid'` karena pembayaran ini, lalu `applyDebtTransaction`
 *   dari nilai baru.
 */
export async function applyDebtTransactionEdit({
  status,
  dangerousFieldsChanged,
  ...input
}: ApplyDebtTransactionEditInput): Promise<TouchedDebtRows> {
  const { db, date } = input;

  if (status.role === "none") {
    return applyDebtTransaction(input);
  }

  if (status.role === "principal") {
    if (!dangerousFieldsChanged) {
      await db.execute("UPDATE debts SET date = $1 WHERE id = $2", [date, status.debtId]);
      return { debtIds: [status.debtId], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
    }
    if (status.hasPayments) {
      throw new DebtEditBlockedError();
    }
    await db.execute("DELETE FROM debts WHERE id = $1", [status.debtId]);
    // id LAMA ikut dilaporkan sbg deleted -- caller WAJIB pushDeleteOnWrite
    // supaya Worker soft-delete baris lama ini juga, BUKAN cuma push
    // baris baru dari applyDebtTransaction di bawah (lihat komentar
    // TouchedDebtRows di atas).
    return mergeTouchedDebtRows(
      { debtIds: [], debtPaymentIds: [], deletedDebtIds: [status.debtId], deletedDebtPaymentIds: [] },
      await applyDebtTransaction(input)
    );
  }

  // status.role === "payment"
  if (!dangerousFieldsChanged) {
    await db.execute("UPDATE debt_payments SET date = $1 WHERE id = $2", [
      date,
      status.debtPaymentId,
    ]);
    return { debtIds: [], debtPaymentIds: [status.debtPaymentId], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  }

  await db.execute("DELETE FROM debt_payments WHERE id = $1", [status.debtPaymentId]);
  // Piutang induknya mungkin sempat ditandai 'paid' karena pembayaran
  // yang baru saja dihapus ini — kalau sekarang ternyata masih ada sisa,
  // kembalikan ke 'ongoing' supaya tidak "hilang" dari daftar berjalan.
  // debts.id-nya IKUT ditandai disentuh (status berubah) WALAU row-nya
  // sendiri tidak dihapus -- caller perlu push ulang supaya Worker tahu
  // status terbaru. debt_payments.id LAMA ikut dilaporkan sbg deleted
  // (alasan sama dgn cabang 'principal' di atas).
  await db.execute(
    `UPDATE debts SET status = 'ongoing'
     WHERE id = $1 AND status = 'paid' AND amount > COALESCE(
       (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
       0
     )`,
    [status.debtId]
  );
  return mergeTouchedDebtRows(
    { debtIds: [status.debtId], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [status.debtPaymentId] },
    await applyDebtTransaction(input)
  );
}

export type DeletedTransactionDebtInfo =
  | { role: "none" }
  | { role: "payment"; debtId: string }
  | { role: "principal"; debtId: string; hadPayments: boolean };

/**
 * Dipanggil SEBELUM hard-delete baris `transactions` (lihat
 * `use-delete-transaction.ts`) — port PERSIS dari
 * `detachDebtForDeletedTransaction` (apps/worker/src/modules/debts/service.ts),
 * supaya PC TIDAK LAGI diam-diam kehilangan jejak piutang lewat FK
 * `ON DELETE SET NULL` biasa (gap lama, lihat "Delete transaksi TIDAK
 * ADA guard sama sekali" di mcp-server-business-logic-audit.md).
 *
 * Tindakan TUNGGAL per role, TIDAK ada pilihan user (keputusan
 * 2026-10-03, dialog tetap 1 tombol konfirmasi generik — lihat
 * cloud-sync.md "DELETE /transactions/:id"):
 * - `role: 'none'`: no-op.
 * - `role: 'payment'`: hapus `debt_payments` ini, revert `debts.status`
 *   ke `'ongoing'` kalau sempat `'paid'` karena pembayaran ini.
 * - `role: 'principal'` (BAIK sudah maupun belum dicicil): `debts.
 *   transaction_id` SET NULL — piutang/cicilan TETAP UTUH scr nominal
 *   (`remaining` dihitung dari `amount - SUM(debt_payments)`, independen
 *   dari `transaction_id`), cuma kehilangan jejak transaksi ASAL.
 */
export async function detachDebtForDeletedTransaction(
  db: Db,
  transactionId: string
): Promise<DeletedTransactionDebtInfo> {
  const status = await getTransactionDebtStatus(db, transactionId);

  if (status.role === "none") {
    return { role: "none" };
  }

  if (status.role === "payment") {
    await db.execute("DELETE FROM debt_payments WHERE id = $1", [status.debtPaymentId]);
    await db.execute(
      `UPDATE debts SET status = 'ongoing'
       WHERE id = $1 AND status = 'paid' AND amount > COALESCE(
         (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
         0
       )`,
      [status.debtId]
    );
    return { role: "payment", debtId: status.debtId };
  }

  // status.role === "principal"
  await db.execute("UPDATE debts SET transaction_id = NULL WHERE id = $1", [status.debtId]);
  return { role: "principal", debtId: status.debtId, hadPayments: status.hasPayments };
}

async function settleDebtsFifo({
  db,
  transactionId,
  accountId,
  amount,
  date,
  settleDebtIds,
}: {
  db: Db;
  transactionId: string;
  accountId: string;
  amount: number;
  date: string;
  settleDebtIds: string[];
}): Promise<TouchedDebtRows> {
  if (settleDebtIds.length === 0)
    return { debtIds: [], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };

  const placeholders = settleDebtIds.map((_, i) => `$${i + 1}`).join(", ");
  const debts = await db.select<OngoingDebtRow[]>(
    `SELECT
       debts.id,
       ${remainingDebtSql()} AS remaining
     FROM debts
     WHERE debts.id IN (${placeholders})
     ORDER BY debts.date ASC, debts.id ASC`,
    settleDebtIds
  );

  const touchedDebtIds: string[] = [];
  const touchedDebtPaymentIds: string[] = [];
  let remainingToAllocate = amount;
  for (const debt of debts) {
    if (remainingToAllocate <= 0) break;
    const allocation = Math.min(debt.remaining, remainingToAllocate);
    if (allocation <= 0) continue;

    const paymentId = newId();
    await db.execute(
      `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [paymentId, debt.id, allocation, accountId, transactionId, date]
    );
    touchedDebtPaymentIds.push(paymentId);

    if (allocation >= debt.remaining) {
      await db.execute("UPDATE debts SET status = 'paid' WHERE id = $1", [debt.id]);
      // debts.id ikut disentuh (status berubah jadi 'paid') -- caller
      // perlu push ulang baris debt-nya, bukan cuma debt_payments baru.
      touchedDebtIds.push(debt.id);
    }

    remainingToAllocate -= allocation;
  }

  return { debtIds: touchedDebtIds, debtPaymentIds: touchedDebtPaymentIds, deletedDebtIds: [], deletedDebtPaymentIds: [] };
}
