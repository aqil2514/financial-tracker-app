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
  /** Jumlah unit yang dibeli — OPSIONAL (keputusan 2026-10-06, revisi dari
   * wajib): order yang masih diproses (mis. reksadana) sering belum tahu
   * unit pastinya sampai settlement dikonfirmasi — null berarti "belum
   * diketahui", diisi belakangan lewat edit baris `investment_purchases`.
   * Lihat use-transaction-investment-fields.ts + konsep-investasi.md
   * bagian "Settlement tertunda". */
  unit: number | null;
  /** Harga per unit saat pembelian — manual, independen dari `unit`
   * (TIDAK divalidasi terhadap nominal transfer), juga OPSIONAL dengan
   * alasan sama seperti `unit` di atas. Lihat
   * docs/concept/konsep-investasi.md bagian "Unit dan harga per unit". */
  pricePerUnit: number | null;
  /** Status awal baris `investment_purchases` — default `'pending'` kalau
   * tidak diisi (form transaksi utama belum punya switch status, selalu
   * pending dulu). `new-purchase-form/` (dialog "Catat Pembelian") punya
   * switch untuk langsung tandai `'settled'` kalau unit/harga sudah pasti
   * saat itu juga — keputusan 2026-10-06, lihat schema.ts (`superRefine`
   * mewajibkan unit/harga diisi kalau status 'settled'). */
  status?: "pending" | "settled";
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
 * - cash -> investment: satu baris `investment_purchases` baru, status
 *   default `'pending'` (settlement dikonfirmasi manual belakangan lewat
 *   edit baris, lihat bagian "Settlement tertunda" di dokumen itu) — tapi
 *   bisa langsung `'settled'` kalau caller sudah tahu nilainya pasti saat
 *   itu juga (lihat parameter `status` di atas).
 * - investment -> cash (penjualan/penarikan sebagian): BUKAN urusan
 *   fungsi ini — no-op (lihat `pairKind !== "cash-investment"` di bawah).
 *   Ditangani fungsi terpisah `applySellInvestmentTransaction`
 *   (apply-sell-investment-transaction.ts) karena model datanya beda
 *   total (average cost, realized P/L, validasi oversell, efek balance
 *   non-nominal — lihat docs/concept/konsep-investasi.md bagian
 *   "Penjualan/penarikan sebagian").
 * - kombinasi lain yang melibatkan investment (investment-debt, dst):
 *   classifyAccountPair sudah throw UnsupportedAccountPairError lebih
 *   dulu (lihat classify-account-pair.ts) — BELUM ada model datanya,
 *   jadi tidak pernah sampai ke sini.
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
  status = "pending",
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

  const id = newId();
  await db.execute(
    `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, transferAccountId, transactionId, unit, pricePerUnit, date, status]
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

async function getTransactionInvestmentPurchaseRow(
  db: Db,
  transactionId: string
): Promise<{ id: string; unit: number | null; price_per_unit: number | null } | null> {
  const rows = await db.select<{ id: string; unit: number | null; price_per_unit: number | null }[]>(
    "SELECT id, unit, price_per_unit FROM investment_purchases WHERE transaction_id = $1",
    [transactionId]
  );
  return rows[0] ?? null;
}

/**
 * Versi `applyInvestmentTransaction` untuk jalur EDIT transaksi — field
 * unit/harga TIDAK divalidasi terhadap nominal (lihat konsep-investasi.md),
 * jadi tidak ada kasus "diblokir" seperti `DebtEditBlockedError` (tidak
 * ada baris lain yang bergantung pada satu `investment_purchases`, beda
 * dari `debts` yang bisa sudah dicicil).
 *
 * **Revisi 2026-10-08 (bug ditemukan lewat dogfooding)**: baris lama TIDAK
 * selalu aman di-delete-lalu-recreate lewat `applyInvestmentTransaction` —
 * fungsi itu `return none` (no-op) untuk `type !== 'transfer'`, sedangkan
 * baris `investment_purchases` juga bisa lahir dari jalur `record_mode:
 * 'direct'` (`createDirectInvestmentPurchase`/`create_investment_purchase_direct`,
 * transaksi `income` LANGSUNG pada akun investment, bukan transfer — lihat
 * konsep-investasi.md "Unit yang berubah TANPA transfer kas"). Transaksi
 * hasil `direct` diedit lewat form transaksi UTAMA tetap `type: 'income'`
 * (field `type` tidak ikut berubah jadi transfer) — delete-lalu-
 * `applyInvestmentTransaction` berarti baris lama terhapus TANPA pengganti
 * sama sekali, karena pemanggilan keduanya cuma jalan untuk transfer.
 *
 * Perbaikan: begitu ada baris lama DAN `type` baru BUKAN `'transfer'`,
 * berarti ini tetap transaksi direct yang sekadar dikoreksi nilainya —
 * UPDATE baris yang sama in-place (unit/harga/tanggal), TIDAK delete+
 * recreate. Delete+recreate lewat `applyInvestmentTransaction` cuma masih
 * valid untuk kasus `type === 'transfer'` (transaksi memang transfer
 * kas<->investment, pola lama yang sudah terbukti aman).
 *
 * **Revisi 2026-10-08 (bug KEDUA ditemukan lewat tes manual fix di atas)**:
 * `unit`/`pricePerUnit` dari `input` TIDAK selalu bisa dipercaya apa
 * adanya untuk cabang `type !== 'transfer'` — field unit/harga TIDAK
 * PERNAH dirender di form transaksi utama untuk income/expense
 * (`needsInvestmentFields` di use-transaction-investment-fields.ts
 * exclusive untuk transfer), dan `defaultValues()` form (`use-update-
 * transaction.ts`) membaca `investmentPurchase` dari query React Query
 * yang ASYNC — dialog bisa submit SEBELUM query itu resolve (race
 * condition, form dirender begitu `transaction` siap tanpa menunggu
 * `investmentPurchase`), mengirim `unit`/`pricePerUnit` berupa `null`
 * walau baris lama punya nilai asli. Fallback ke nilai LAMA (`existing.unit`/
 * `existing.price_per_unit`) kalau input baru `null` — user tidak pernah
 * bisa sengaja mengosongkan field yang bahkan tidak ditampilkan di form.
 */
export async function applyInvestmentTransactionEdit(
  input: ApplyInvestmentTransactionInput
): Promise<TouchedInvestmentRows> {
  const { db, transactionId, type, unit, pricePerUnit, date } = input;
  const existing = await getTransactionInvestmentPurchaseRow(db, transactionId);

  if (existing == null) {
    return applyInvestmentTransaction(input);
  }

  if (type !== "transfer") {
    await db.execute(
      "UPDATE investment_purchases SET unit = $1, price_per_unit = $2, date = $3 WHERE id = $4",
      [unit ?? existing.unit, pricePerUnit ?? existing.price_per_unit, date, existing.id]
    );
    return { investmentPurchaseIds: [existing.id], deletedInvestmentPurchaseIds: [] };
  }

  await db.execute("DELETE FROM investment_purchases WHERE id = $1", [existing.id]);
  const result = await applyInvestmentTransaction(input);
  return {
    investmentPurchaseIds: result.investmentPurchaseIds,
    deletedInvestmentPurchaseIds: [existing.id, ...result.deletedInvestmentPurchaseIds],
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
