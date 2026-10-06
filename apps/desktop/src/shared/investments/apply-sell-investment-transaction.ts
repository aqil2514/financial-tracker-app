import { getDb, type Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import { getAverageCostPerUnit, getRemainingUnit } from "./investment-holding-math";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Dilempar saat unit yang mau dijual > sisa unit yang dimiliki (rumus di
 * getRemainingUnit di bawah) — WAJIB ditolak (beda dari filosofi "tidak
 * menghakimi data" yang dipakai untuk unit/harga saat BELI, lihat
 * docs/concept/konsep-investasi.md bagian "Validasi: cegah oversell"),
 * karena representasi matematisnya memang tidak mungkin valid. Pola gaya
 * sama UnsupportedAccountPairError (classify-account-pair.ts).
 */
export class InsufficientInvestmentUnitsError extends Error {
  constructor(remainingUnit: number, requestedUnit: number) {
    super(
      `Unit yang dijual (${requestedUnit}) melebihi sisa unit yang dimiliki (${remainingUnit}). ` +
        `Kurangi jumlah unit yang dijual, atau periksa kembali riwayat pembelian/penjualan akun ini.`
    );
    this.name = "InsufficientInvestmentUnitsError";
  }
}

export type ApplySellInvestmentTransactionInput = {
  db: Db;
  /** Id baris `transactions` leg transfer UTAMA (investment -> cash,
   * `amount = averageCost × unit`) yang SUDAH di-INSERT oleh caller
   * SEBELUM memanggil fungsi ini — pola PERSIS `applyInvestmentTransaction`/
   * `applyDebtTransaction` (caller selalu yang insert transaksi, fungsi
   * `apply*` ini cuma urus baris satelit). WAJIB diisi kalau
   * `status === 'settled'`; HARUS `null` kalau `status === 'pending'`
   * (TIDAK ada transaksi yang boleh dibuat sama sekali untuk pending,
   * lihat komentar panjang di bawah). */
  transactionId: string | null;
  /** Akun investment — SUMBER transfer (arah investment -> cash). */
  accountId: string;
  /** Akun kas — TUJUAN transfer. */
  transferAccountId: string | null;
  date: string;
  /** Jumlah unit yang dijual — WAJIB diisi (beda dari beli yang opsional,
   * lihat apply-investment-transaction.ts: order beli boleh belum tahu
   * unit pasti, tapi jual harus tahu persis berapa unit yang dilepas
   * untuk divalidasi terhadap sisa unit). */
  unit: number;
  /** Harga jual per unit saat itu — WAJIB diisi, dipakai menghitung
   * Realized P/L (lihat realizedPl di bawah). */
  pricePerUnit: number;
  /** Status awal baris `investment_sales` — default `'pending'`. BEDA
   * dari `investment_purchases`: di sini `pending` TIDAK membuat baris
   * `transactions` apa pun (dana belum cair, lihat komentar panjang di
   * applySellInvestmentTransaction) — cuma `settled` yang membuatnya.
   * Unit TETAP dikurangi dari holding begitu baris dibuat (OPTIMIS, lihat
   * getRemainingUnit) terlepas dari status ini. */
  status?: "pending" | "settled";
};

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

export type TouchedInvestmentSaleRows = {
  investmentSaleIds: string[];
  deletedInvestmentSaleIds: string[];
  /** Id transaksi `income`/`expense` penyesuaian Realized P/L yang dibuat
   * di akun kas (lihat komentar panjang di applySellInvestmentTransaction
   * soal kenapa dibutuhkan transaksi kedua) — null kalau statusnya masih
   * `pending` (belum ada transaksi apa pun, lihat bawah) ATAU realizedPl
   * == 0 (tidak ada selisih untuk disesuaikan). */
  adjustmentTransactionId: string | null;
};

const none: TouchedInvestmentSaleRows = {
  investmentSaleIds: [],
  deletedInvestmentSaleIds: [],
  adjustmentTransactionId: null,
};

/**
 * Buat satu baris `investment_sales` (pola sama `applyInvestmentTransaction`
 * untuk arah beli, lihat apply-investment-transaction.ts) — mengikuti
 * model di docs/concept/konsep-investasi.md bagian "Penjualan/penarikan
 * sebagian".
 *
 * **Keputusan 2026-10-07 (revisi dari desain awal)**: dana hasil jual
 * TIDAK boleh langsung "cair" ke kas selama order masih `pending` —
 * secara riil (reksadana T+1/T+2, saham T+2), uang baru benar-benar bisa
 * dipakai setelah settlement dikonfirmasi. Maka:
 *
 * - **Status `pending`**: HANYA baris `investment_sales` yang dibuat
 *   (`unit`, `price_per_unit` terisi — itu yang diminta/diestimasi user
 *   saat itu). `average_cost_per_unit` dan `realized_pl` **NULL** (belum
 *   dihitung sama sekali — average cost bisa masih bergeser kalau ada
 *   pembelian baru sebelum settle, dan Realized P/L belum final sampai
 *   benar-benar settled, lihat konsep-investasi.md "Realized gain/loss").
 *   `transaction_id`/`adjustment_transaction_id` NULL — **TIDAK ada
 *   baris `transactions` yang dibuat sama sekali**, kas belum tersentuh.
 *   Unit TETAP berkurang dari holding secara optimis (getRemainingUnit
 *   membaca `investment_sales` langsung, tidak bergantung ke `transactions`).
 * - **Status `settled`** (baik langsung saat create, maupun lewat
 *   `settleInvestmentSale` di bawah): average cost dihitung SAAT INI,
 *   Realized P/L dihitung & DISIMPAN sebagai snapshot permanen (TIDAK
 *   dihitung ulang lagi setelahnya), DAN baris `transactions` (leg
 *   transfer + leg penyesuaian P/L) baru dibuat di titik ini.
 * - Validasi oversell (unit > sisa_unit) tetap dicek di KEDUA jalur
 *   (pending maupun settled) — unit sudah dikurangi optimis sejak
 *   pending, jadi batasnya harus ditegakkan sejak awal, bukan ditunda ke
 *   settle.
 *
 * **Efek ke `accounts.balance` saat settled (keputusan arsitektur)**:
 * `balance` di app ini SELALU live-computed dari `initial_balance +
 * SUM(transactions)` (lihat use-accounts.ts, tidak ada kolom tersimpan)
 * — dan untuk SATU baris `transactions` tipe transfer, kolom `amount`-nya
 * SAMA dipakai mengurangi saldo sumber DAN menambah saldo tujuan (tidak
 * ada asimetri dalam satu baris). Karena balance akun investment harus
 * berkurang sebesar `averageCost × unit` (BUKAN nominal jual
 * `pricePerUnit × unit` yang sudah termasuk P/L, lihat
 * konsep-investasi.md), nominal transfer yang di-INSERT ke
 * `transactions.amount` adalah `averageCost × unit` — BUKAN nominal yang
 * "diterima" user. Selisihnya (realizedPl) TIDAK hilang: direpresentasikan
 * sebagai transaksi KEDUA `income`/`expense` langsung di akun KAS (bukan
 * investment) sebesar `|realizedPl|` — pola "transaksi penutup" yang
 * sudah ada di app ini (lihat docs/concept/konsep-transaksi.md "Dua jenis
 * transaksi"), supaya kas tetap menerima nominal penuh hasil jual (`unit
 * × pricePerUnit`) sementara balance investment murni berkurang sebesar
 * cost basis yang dilepas. Transaksi kedua ini TIDAK menyentuh akun
 * investment sama sekali. Id transaksi kedua ini disimpan sebagai FK
 * EKSPLISIT di `investment_sales.adjustment_transaction_id` (migrasi
 * 0039) — bukan dicari balik lewat kombinasi note+account+date — supaya
 * edit/delete (lihat deleteInvestmentSaleAndAdjustment di bawah) tidak
 * pernah salah ambil baris kalau ada >1 penjualan di akun+tanggal yang
 * sama.
 *
 * **Siapa yang insert leg transfer utama**: pola PERSIS
 * `applyInvestmentTransaction`/`applyDebtTransaction` — fungsi `apply*`
 * ini TIDAK PERNAH insert leg transfer utama sendiri, caller yang
 * melakukannya SEBELUM memanggil fungsi ini (lihat `transactionId` di
 * `ApplySellInvestmentTransactionInput`). Untuk `status === 'pending'`,
 * `transactionId` HARUS `null` (caller TIDAK boleh insert apa pun). Untuk
 * `status === 'settled'`, caller WAJIB sudah insert transaksi transfer
 * `amount = averageCost × unit` (lihat getAverageCostPerUnit) dan
 * mengoper `transactionId` hasilnya — fungsi ini cuma menambahkan leg
 * KEDUA (penyesuaian P/L, kalau ada selisih) dan baris `investment_sales`.
 */
export async function applySellInvestmentTransaction({
  db,
  transactionId,
  accountId,
  transferAccountId,
  date,
  unit,
  pricePerUnit,
  status = "pending",
}: ApplySellInvestmentTransactionInput): Promise<TouchedInvestmentSaleRows> {
  if (transferAccountId == null) return none;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  if (sourceType == null || destinationType == null) {
    throw new Error("Akun sumber/tujuan transfer tidak ditemukan.");
  }

  // classifyAccountPair throw utk kombinasi investment di luar
  // cash-investment/investment-cash (lihat classify-account-pair.ts) --
  // seharusnya sudah dicegat lebih dulu oleh validasi form, ini safety net
  // sama seperti di apply-investment-transaction.ts.
  const pairKind = classifyAccountPair(sourceType, destinationType);
  if (pairKind !== "investment-cash") return none;

  const remainingUnit = await getRemainingUnit(db, accountId);
  if (unit > remainingUnit) {
    throw new InsufficientInvestmentUnitsError(remainingUnit, unit);
  }

  const saleId = newId();

  if (status === "pending") {
    await db.execute(
      `INSERT INTO investment_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status)
       VALUES ($1, $2, NULL, NULL, $3, $4, NULL, NULL, $5, 'pending')`,
      [saleId, accountId, unit, pricePerUnit, date]
    );
    return { investmentSaleIds: [saleId], deletedInvestmentSaleIds: [], adjustmentTransactionId: null };
  }

  if (transactionId == null) {
    throw new Error("transactionId wajib diisi untuk status 'settled' (leg transfer utama harus sudah di-insert).");
  }

  const averageCost = await getAverageCostPerUnit(db, accountId);
  const { adjustmentTransactionId, realizedPl } = await createAdjustmentTransaction(db, {
    transferAccountId,
    date,
    unit,
    pricePerUnit,
    averageCost,
  });

  await db.execute(
    `INSERT INTO investment_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'settled')`,
    [saleId, accountId, transactionId, adjustmentTransactionId, unit, pricePerUnit, averageCost, realizedPl, date]
  );

  return { investmentSaleIds: [saleId], deletedInvestmentSaleIds: [], adjustmentTransactionId };
}

/**
 * Insert leg penyesuaian P/L (kalau ada selisih `realizedPl`) — dipakai
 * BERSAMA oleh `applySellInvestmentTransaction` (status settled langsung
 * saat create) dan `settleInvestmentSale` (settle baris pending). Average
 * cost dihitung oleh CALLER (SAAT settle benar-benar terjadi — BUKAN
 * saat baris `investment_sales` pertama kali dibuat, lihat komentar
 * applySellInvestmentTransaction soal kenapa Realized P/L tidak ditulis
 * prematur saat masih pending) dan dioper ke sini sebagai parameter —
 * supaya tidak dihitung dua kali dalam satu alur yang sama (caller yang
 * insert leg transfer utama juga butuh angka ini).
 */
async function createAdjustmentTransaction(
  db: Db,
  params: { transferAccountId: string; date: string; unit: number; pricePerUnit: number; averageCost: number }
): Promise<{ adjustmentTransactionId: string | null; realizedPl: number }> {
  const { transferAccountId, date, unit, pricePerUnit, averageCost } = params;
  const realizedPl = (pricePerUnit - averageCost) * unit;

  let adjustmentTransactionId: string | null = null;
  if (realizedPl !== 0) {
    adjustmentTransactionId = newId();
    const adjustmentType = realizedPl > 0 ? "income" : "expense";
    await db.execute(
      `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
       VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, $6)`,
      [
        adjustmentTransactionId,
        adjustmentType,
        Math.abs(realizedPl),
        transferAccountId,
        "Realized P/L penjualan investasi",
        date,
      ]
    );
  }

  return { adjustmentTransactionId, realizedPl };
}

/**
 * Settle satu baris `investment_sales` yang masih `pending` — baru di
 * titik INILAH dana benar-benar "cair": leg transfer utama + penyesuaian
 * P/L dibuat (lihat createAdjustmentTransaction), average cost & Realized
 * P/L dihitung dari kondisi SAAT INI (bukan saat baris dibuat) dan
 * disimpan permanen, baris `investment_sales` di-UPDATE jadi
 * `status='settled'` dengan kedua FK terisi.
 *
 * `transferAccountId` (akun kas tujuan) WAJIB dioper eksplisit oleh
 * caller (dipilih user lewat dialog "Settle" di UI) — `investment_sales`
 * TIDAK menyimpan akun kas tujuan sejak create (cuma `account_id` = akun
 * investment sumber), karena saat masih pending belum ada transaksi/akun
 * kas yang terlibat sama sekali.
 *
 * Tidak berlaku untuk baris yang sudah `settled` (punya `transaction_id`)
 * — caller (UI tombol "Settle") seharusnya cuma memanggil ini untuk baris
 * pending, tapi dicek ulang di sini sebagai safety net.
 */
export async function settleInvestmentSale(
  db: Db,
  saleId: string,
  transferAccountId: string
): Promise<{ transactionId: string; adjustmentTransactionId: string | null }> {
  const rows = await db.select<
    { account_id: string; unit: number; price_per_unit: number; date: string; status: string; transaction_id: string | null }[]
  >(
    "SELECT account_id, unit, price_per_unit, date, status, transaction_id FROM investment_sales WHERE id = $1",
    [saleId]
  );
  const sale = rows[0];
  if (sale == null) throw new Error("Baris penjualan investasi tidak ditemukan.");
  if (sale.status === "settled" || sale.transaction_id != null) {
    throw new Error("Penjualan ini sudah settled.");
  }

  // Tidak perlu validasi oversell ulang di sini -- unit baris ini SUDAH
  // ikut dihitung sebagai "terjual" oleh getRemainingUnit sejak status
  // pending (lihat investment-holding-math.ts), sudah ditegakkan saat
  // applySellInvestmentTransaction membuat baris ini.

  // Tidak ada "caller form" di jalur settle (dipanggil dari aksi
  // tombol/menu, bukan submit form transaksi) -- fungsi ini sendiri yang
  // insert leg transfer utama, beda dari applySellInvestmentTransaction
  // yang selalu menerima transactionId siap pakai dari caller.
  const averageCostForTransfer = await getAverageCostPerUnit(db, sale.account_id);
  const transactionId = newId();
  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
     VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6)`,
    [
      transactionId,
      averageCostForTransfer * sale.unit,
      sale.account_id,
      transferAccountId,
      "Settlement penjualan investasi",
      sale.date,
    ]
  );

  const { adjustmentTransactionId, realizedPl } = await createAdjustmentTransaction(db, {
    transferAccountId,
    date: sale.date,
    unit: sale.unit,
    pricePerUnit: sale.price_per_unit,
    averageCost: averageCostForTransfer,
  });

  await db.execute(
    `UPDATE investment_sales
     SET transaction_id = $1, adjustment_transaction_id = $2, average_cost_per_unit = $3, realized_pl = $4, status = 'settled'
     WHERE id = $5`,
    [transactionId, adjustmentTransactionId, averageCostForTransfer, realizedPl, saleId]
  );

  return { transactionId, adjustmentTransactionId };
}

export type DeletedTransactionInvestmentSaleInfo =
  | { role: "none" }
  | { role: "sale"; investmentSaleId: string; adjustmentTransactionId: string | null };

async function getTransactionInvestmentSale(
  db: Db,
  transactionId: string
): Promise<{ id: string } | null> {
  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM investment_sales WHERE transaction_id = $1",
    [transactionId]
  );
  return rows[0] ?? null;
}

/**
 * Versi `applySellInvestmentTransaction` untuk jalur EDIT transaksi —
 * HANYA dipanggil dari form transaksi UTAMA (`use-update-transaction.ts`),
 * yang (keputusan 2026-10-07) cuma mendukung jual `status: 'settled'`
 * (lihat InvestmentFields: toggle status disembunyikan untuk arah jual,
 * selalu dipaksa settled) — jadi baris `investment_sales` yang diedit di
 * sini SELALU sudah py `transaction_id` terisi, aman dicari lewat
 * `transactionId` transaksi utama yang sedang diedit.
 *
 * (Edit baris `investment_sales` PENDING hasil dialog "Jual Investasi"
 * khusus — yang tidak py `transaction_id` sama sekali — BUKAN lewat jalur
 * ini, belum ada UI-nya; lihat sales-history-table.tsx TODO "belum ada
 * aksi edit per baris".)
 *
 * Pola sama `applyInvestmentTransactionEdit` (apply-investment-transaction.ts):
 * hapus baris `investment_sales` lama (+ transaksi penyesuaian P/L lama
 * kalau ada, via `deleteInvestmentSaleAndAdjustment` — FK eksplisit, tidak
 * perlu bantuan caller), buat baris baru `settled` dari nilai saat ini.
 * Caller TETAP bertanggung jawab atas leg transfer UTAMA (nominalnya,
 * `averageCost × unit`) — sama seperti `applyInvestmentTransactionEdit`
 * yang juga tidak mengurus transaksi transfer utama.
 */
export async function applySellInvestmentTransactionEdit(
  transactionId: string,
  input: ApplySellInvestmentTransactionInput
): Promise<TouchedInvestmentSaleRows> {
  const { db } = input;
  const existing = await getTransactionInvestmentSale(db, transactionId);

  if (existing == null) {
    return applySellInvestmentTransaction({ ...input, status: "settled" });
  }

  // Transaksi penyesuaian P/L LAMA (kalau ada) ikut terhapus di sini --
  // caller cuma perlu tahu baris investment_sales lama yang terhapus
  // (sama seperti applyInvestmentTransactionEdit), id transaksi
  // penyesuaian lama tidak perlu dikembalikan terpisah.
  await deleteInvestmentSaleAndAdjustment(db, existing.id);
  const result = await applySellInvestmentTransaction({ ...input, status: "settled" });
  return {
    investmentSaleIds: result.investmentSaleIds,
    deletedInvestmentSaleIds: [existing.id, ...result.deletedInvestmentSaleIds],
    adjustmentTransactionId: result.adjustmentTransactionId,
  };
}

/** Hard-delete satu baris `investment_sales` + transaksi penyesuaian P/L
 * miliknya (kalau ada, lihat kolom `adjustment_transaction_id` — FK
 * eksplisit, migrasi 0039) — dipakai edit (recreate) dan delete transaksi.
 * Mengembalikan id transaksi penyesuaian yang ikut terhapus (atau null). */
async function deleteInvestmentSaleAndAdjustment(db: Db, saleId: string): Promise<string | null> {
  const rows = await db.select<{ adjustment_transaction_id: string | null }[]>(
    "SELECT adjustment_transaction_id FROM investment_sales WHERE id = $1",
    [saleId]
  );
  const adjustmentId = rows[0]?.adjustment_transaction_id ?? null;

  await db.execute("DELETE FROM investment_sales WHERE id = $1", [saleId]);

  if (adjustmentId != null) {
    await db.execute("DELETE FROM transactions WHERE id = $1", [adjustmentId]);
  }
  return adjustmentId;
}

/**
 * Dipanggil SEBELUM hard-delete baris `transactions` (leg transfer) --
 * port pola `detachInvestmentPurchaseForDeletedTransaction`, tapi juga
 * membersihkan transaksi penyesuaian P/L (leg kedua) yang menjadi
 * tanggung jawab fungsi ini sendiri (dibuat oleh
 * applySellInvestmentTransaction, bukan oleh caller).
 */
export async function detachInvestmentSaleForDeletedTransaction(
  db: Db,
  transactionId: string
): Promise<DeletedTransactionInvestmentSaleInfo> {
  const existing = await getTransactionInvestmentSale(db, transactionId);
  if (existing == null) return { role: "none" };

  const adjustmentTransactionId = await deleteInvestmentSaleAndAdjustment(db, existing.id);
  return { role: "sale", investmentSaleId: existing.id, adjustmentTransactionId };
}

/**
 * Hapus satu baris `investment_sales` yang MASIH `pending` (belum py
 * `transaction_id`, lihat applySellInvestmentTransaction) — dipanggil
 * LANGSUNG dari UI riwayat penjualan (SalesHistoryTable), BUKAN dari
 * jalur hapus transaksi (`detachInvestmentSaleForDeletedTransaction`)
 * karena baris pending tidak terikat transaksi apa pun untuk di-trigger
 * cascade-nya. Menolak baris yang sudah `settled` — itu cuma boleh
 * dihapus lewat hapus transaksi utamanya (konsisten dgn semua baris
 * lain yang py transaksi riil).
 */
export async function deletePendingInvestmentSale(db: Db, saleId: string): Promise<void> {
  const rows = await db.select<{ status: string; transaction_id: string | null }[]>(
    "SELECT status, transaction_id FROM investment_sales WHERE id = $1",
    [saleId]
  );
  const sale = rows[0];
  if (sale == null) throw new Error("Baris penjualan investasi tidak ditemukan.");
  if (sale.status === "settled" || sale.transaction_id != null) {
    throw new Error("Penjualan yang sudah settled hanya bisa dihapus lewat hapus transaksinya.");
  }

  await db.execute("DELETE FROM investment_sales WHERE id = $1", [saleId]);
}
