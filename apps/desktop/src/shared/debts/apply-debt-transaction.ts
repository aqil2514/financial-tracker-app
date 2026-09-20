import { getDb, type Account } from "@/lib/db";
import type { TransactionDebtStatus } from "./use-transaction-debt-status";

type Db = Awaited<ReturnType<typeof getDb>>;

type OngoingDebtRow = { id: number; remaining: number };

export type ApplyDebtTransactionInput = {
  db: Db;
  transactionId: number;
  type: "income" | "expense" | "transfer";
  accountId: number;
  /** Hanya terisi untuk `type === 'transfer'`. */
  transferAccountId: number | null;
  contactId: number | null;
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

async function getAccountType(db: Db, accountId: number): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
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
}: ApplyDebtTransactionInput): Promise<void> {
  if (type !== "transfer" || transferAccountId == null) return;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  const sourceIsDebt = sourceType === "debt";
  const destinationIsDebt = destinationType === "debt";

  if (sourceIsDebt === destinationIsDebt) {
    // Baik "kas -> kas" (bukan urusan debt) maupun "debt -> debt"
    // (di luar scope, lihat dokumen desain) — tidak melakukan apa-apa.
    return;
  }

  if (destinationIsDebt) {
    // Kas -> Debt: piutang baru, tidak ambigu.
    await db.execute(
      `INSERT INTO debts (type, contact_id, amount, account_id, transaction_id, date)
       VALUES ('receivable', $1, $2, $3, $4, $5)`,
      [contactId, amount, transferAccountId, transactionId, date]
    );
    return;
  }

  // Debt -> Kas: butuh keputusan eksplisit dari form.
  if (debtAction === "payable") {
    await db.execute(
      `INSERT INTO debts (type, contact_id, amount, account_id, transaction_id, date)
       VALUES ('payable', $1, $2, $3, $4, $5)`,
      [contactId, amount, accountId, transactionId, date]
    );
    return;
  }

  if (debtAction === "settlement") {
    await settleDebtsFifo({ db, transactionId, accountId, amount, date, settleDebtIds });
  }
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
}: ApplyDebtTransactionEditInput): Promise<void> {
  const { db, date } = input;

  if (status.role === "none") {
    await applyDebtTransaction(input);
    return;
  }

  if (status.role === "principal") {
    if (!dangerousFieldsChanged) {
      await db.execute("UPDATE debts SET date = $1 WHERE id = $2", [date, status.debtId]);
      return;
    }
    if (status.hasPayments) {
      throw new DebtEditBlockedError();
    }
    await db.execute("DELETE FROM debts WHERE id = $1", [status.debtId]);
    await applyDebtTransaction(input);
    return;
  }

  // status.role === "payment"
  if (!dangerousFieldsChanged) {
    await db.execute("UPDATE debt_payments SET date = $1 WHERE id = $2", [
      date,
      status.debtPaymentId,
    ]);
    return;
  }

  await db.execute("DELETE FROM debt_payments WHERE id = $1", [status.debtPaymentId]);
  // Piutang induknya mungkin sempat ditandai 'paid' karena pembayaran
  // yang baru saja dihapus ini — kalau sekarang ternyata masih ada sisa,
  // kembalikan ke 'ongoing' supaya tidak "hilang" dari daftar berjalan.
  await db.execute(
    `UPDATE debts SET status = 'ongoing'
     WHERE id = $1 AND status = 'paid' AND amount > COALESCE(
       (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
       0
     )`,
    [status.debtId]
  );
  await applyDebtTransaction(input);
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
  transactionId: number;
  accountId: number;
  amount: number;
  date: string;
  settleDebtIds: string[];
}): Promise<void> {
  if (settleDebtIds.length === 0) return;

  const ids = settleDebtIds.map(Number);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const debts = await db.select<OngoingDebtRow[]>(
    `SELECT
       debts.id,
       debts.amount - COALESCE(
         (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
         0
       ) AS remaining
     FROM debts
     WHERE debts.id IN (${placeholders})
     ORDER BY debts.date ASC, debts.id ASC`,
    ids
  );

  let remainingToAllocate = amount;
  for (const debt of debts) {
    if (remainingToAllocate <= 0) break;
    const allocation = Math.min(debt.remaining, remainingToAllocate);
    if (allocation <= 0) continue;

    await db.execute(
      `INSERT INTO debt_payments (debt_id, amount, account_id, transaction_id, date)
       VALUES ($1, $2, $3, $4, $5)`,
      [debt.id, allocation, accountId, transactionId, date]
    );

    if (allocation >= debt.remaining) {
      await db.execute("UPDATE debts SET status = 'paid' WHERE id = $1", [debt.id]);
    }

    remainingToAllocate -= allocation;
  }
}
