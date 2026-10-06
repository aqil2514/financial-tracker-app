import { getDb, type Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";

type Db = Awaited<ReturnType<typeof getDb>>;

export type ApplyInvestmentTransactionInput = {
  db: Db;
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  /** Hanya terisi untuk `type === 'transfer'`. */
  transferAccountId: string | null;
  date: string;
  /** Jumlah unit yang dibeli — WAJIB terisi saat transfer tujuannya akun
   * `investment` (lihat use-transaction-investment-fields.ts), null di
   * luar kasus itu. */
  unit: number | null;
  /** Harga per unit saat pembelian — manual, independen dari `unit`
   * (TIDAK divalidasi terhadap nominal transfer), lihat
   * docs/concept/konsep-investasi.md bagian "Unit dan harga per unit". */
  pricePerUnit: number | null;
};

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

export type TouchedInvestmentRows = {
  investmentPurchaseIds: string[];
  deletedInvestmentPurchaseIds: string[];
};

const none: TouchedInvestmentRows = { investmentPurchaseIds: [], deletedInvestmentPurchaseIds: [] };

/**
 * Setelah transaksi transfer tersimpan, deteksi apakah transfer ini
 * kas -> akun `account_type='investment'` dan, kalau ya, buat satu baris
 * `investment_purchases` (pola sama `applyDebtTransaction` membuat
 * `debts` dari transfer kas<->debt — lihat apply-debt-transaction.ts) —
 * mengikuti model di docs/concept/konsep-investasi.md bagian "Unit dan
 * harga per unit":
 *
 * - cash -> investment: satu baris `investment_purchases` baru,
 *   `status='pending'` (settlement dikonfirmasi manual belakangan lewat
 *   edit baris, lihat bagian "Settlement tertunda" di dokumen itu).
 * - kombinasi lain yang melibatkan investment (investment -> cash, dst):
 *   classifyAccountPair sudah throw UnsupportedAccountPairError lebih
 *   dulu (lihat classify-account-pair.ts) — BELUM ada model datanya
 *   (pertanyaan terbuka FIFO/realized gain-loss), jadi tidak pernah
 *   sampai ke sini.
 *
 * Dipanggil SETELAH insert baris `transactions` selesai (butuh
 * `transactionId` untuk `investment_purchases.transaction_id`).
 */
export async function applyInvestmentTransaction({
  db,
  transactionId,
  type,
  accountId,
  transferAccountId,
  date,
  unit,
  pricePerUnit,
}: ApplyInvestmentTransactionInput): Promise<TouchedInvestmentRows> {
  if (type !== "transfer" || transferAccountId == null) return none;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  if (sourceType == null || destinationType == null) {
    throw new Error("Akun sumber/tujuan transfer tidak ditemukan.");
  }

  // classifyAccountPair throw utk kombinasi investment di luar
  // cash-investment (lihat classify-account-pair.ts) -- seharusnya sudah
  // dicegat lebih dulu oleh validasi form
  // (use-transaction-investment-fields.ts), ini safety net.
  const pairKind = classifyAccountPair(sourceType, destinationType);

  if (pairKind !== "cash-investment") return none;

  if (unit == null || pricePerUnit == null) {
    throw new Error("Jumlah unit dan harga per unit wajib diisi untuk transfer ke akun investasi.");
  }

  const id = newId();
  await db.execute(
    `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, transferAccountId, transactionId, unit, pricePerUnit, date]
  );
  return { investmentPurchaseIds: [id], deletedInvestmentPurchaseIds: [] };
}

export type DeletedTransactionInvestmentInfo =
  | { role: "none" }
  | { role: "purchase"; investmentPurchaseId: string };

async function getTransactionInvestmentPurchaseId(
  db: Db,
  transactionId: string
): Promise<string | null> {
  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM investment_purchases WHERE transaction_id = $1",
    [transactionId]
  );
  return rows[0]?.id ?? null;
}

/**
 * Versi `applyInvestmentTransaction` untuk jalur EDIT transaksi — field
 * unit/harga TIDAK divalidasi terhadap nominal (lihat konsep-investasi.md),
 * jadi tidak ada kasus "diblokir" seperti `DebtEditBlockedError` (tidak
 * ada baris lain yang bergantung pada satu `investment_purchases`, beda
 * dari `debts` yang bisa sudah dicicil). Field berbahaya berubah -> hapus
 * baris lama, buat baris baru dari nilai saat ini — selalu aman.
 */
export async function applyInvestmentTransactionEdit(
  input: ApplyInvestmentTransactionInput
): Promise<TouchedInvestmentRows> {
  const { db, transactionId } = input;
  const existingId = await getTransactionInvestmentPurchaseId(db, transactionId);

  if (existingId == null) {
    return applyInvestmentTransaction(input);
  }

  await db.execute("DELETE FROM investment_purchases WHERE id = $1", [existingId]);
  const result = await applyInvestmentTransaction(input);
  return {
    investmentPurchaseIds: result.investmentPurchaseIds,
    deletedInvestmentPurchaseIds: [existingId, ...result.deletedInvestmentPurchaseIds],
  };
}

/**
 * Dipanggil SEBELUM hard-delete baris `transactions` (lihat
 * `use-delete-transaction.ts`) — port pola `detachDebtForDeletedTransaction`
 * (apply-debt-transaction.ts), tapi lebih sederhana: `investment_purchases`
 * TIDAK punya baris anak (beda dari `debts` yang bisa sudah dicicil), jadi
 * cukup hard-delete baris itu sekalian — tidak ada yang kehilangan jejak
 * nominalnya, karena `investment_purchases` BUKAN tumpuan `accounts.balance`
 * (itu tetap murni dari `transactions`, lihat konsep-investasi.md).
 */
export async function detachInvestmentPurchaseForDeletedTransaction(
  db: Db,
  transactionId: string
): Promise<DeletedTransactionInvestmentInfo> {
  const existingId = await getTransactionInvestmentPurchaseId(db, transactionId);
  if (existingId == null) return { role: "none" };

  await db.execute("DELETE FROM investment_purchases WHERE id = $1", [existingId]);
  return { role: "purchase", investmentPurchaseId: existingId };
}
