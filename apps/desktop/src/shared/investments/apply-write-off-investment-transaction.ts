import { getDb, type Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { getAverageCostPerUnit, getRemainingUnit } from "./investment-holding-math";
import { InsufficientInvestmentUnitsError } from "./apply-sell-investment-transaction";

type Db = Awaited<ReturnType<typeof getDb>>;

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

export type ApplyWriteOffInvestmentTransactionInput = {
  db: Db;
  accountId: string;
  date: string;
  note: string;
  /** Jumlah unit yang hilang/dilepas — WAJIB, divalidasi terhadap sisa
   * unit sama seperti jual (getRemainingUnit), beda dari beli yang
   * opsional. */
  unit: number;
};

export type WriteOffInvestmentTransactionResult = {
  transactionId: string;
  investmentSaleId: string;
  /** Average cost per unit SAAT write-off terjadi — disimpan sebagai
   * snapshot di baris investment_sales, sama pola Realized P/L jual. */
  averageCost: number;
};

/**
 * Catat unit yang hilang/dilepas TANPA kas yang berpindah (hibah ke orang
 * lain, delisting/perusahaan bangkrut, biaya admin dipotong dalam bentuk
 * unit) — lihat docs/concept/konsep-investasi.md bagian "Unit yang
 * berubah TANPA transfer kas", arah berkurang.
 *
 * BEDA dari `applySellInvestmentTransaction` (jual ke kas): write-off
 * TIDAK PERNAH punya akun kas tujuan — pola yang dipakai di sini adalah
 * `write_off_debt`/`writeOffDebt` (apps/worker/src/modules/debts/service.ts),
 * BUKAN `applySellInvestmentTransaction`. Satu transaksi `expense` dibuat
 * LANGSUNG pada akun investment itu sendiri (account_id = accountId,
 * transfer_account_id = NULL) sebesar `averageCost × unit` — balance
 * akun investment berkurang sebesar cost basis yang dilepas, SAMA pola
 * nominal yang dipakai jual (BUKAN nominal manual bebas user — keputusan
 * 2026-10-08, supaya Realized P/L tetap konsisten dengan average cost
 * gabungan, sama alasan `price_per_unit` wajib diisi di arah bertambah).
 * Realized P/L hasilnya SELALU `-averageCost × unit` (kerugian penuh —
 * seluruh cost basis unit yang dilepas "menguap", tidak ada nilai yang
 * diterima balik).
 *
 * Direpresentasikan sebagai baris `investment_sales` baru (BUKAN kolom
 * negatif di `investment_purchases` — supaya `getAverageCostPerUnit()`
 * TIDAK ikut tercemar oleh unit negatif berharga sembarang) dengan
 * `price_per_unit = 0` (tidak ada nilai yang diterima), `adjustment_
 * transaction_id = NULL` (TIDAK ada leg kedua ke kas — beda dari jual
 * yang punya leg penyesuaian P/L di akun KAS, di sini P/L-nya sudah
 * tercermin penuh di SATU transaksi expense pada akun investment),
 * status selalu `'settled'` (tidak ada konsep pending untuk write-off —
 * nilainya sudah final saat dicatat). `getRemainingUnit()` otomatis ikut
 * mengurangi unit ini karena SUM dari `investment_sales` TIDAK bergantung
 * pada `price_per_unit`/`adjustment_transaction_id`.
 */
export async function applyWriteOffInvestmentTransaction({
  db,
  accountId,
  date,
  note,
  unit,
}: ApplyWriteOffInvestmentTransactionInput): Promise<WriteOffInvestmentTransactionResult> {
  const accountType = await getAccountType(db, accountId);
  if (accountType !== "investment") {
    throw new Error("Akun write-off harus bertipe 'investment'.");
  }

  const remainingUnit = await getRemainingUnit(db, accountId);
  if (unit > remainingUnit) {
    throw new InsufficientInvestmentUnitsError(remainingUnit, unit);
  }

  const averageCost = await getAverageCostPerUnit(db, accountId);
  const amount = averageCost * unit;
  const realizedPl = -amount;

  const transactionId = newId();
  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
     VALUES ($1, 'expense', $2, NULL, $3, NULL, $4, NULL, $5)`,
    [transactionId, amount, accountId, note, date]
  );

  const investmentSaleId = newId();
  await db.execute(
    `INSERT INTO investment_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status)
     VALUES ($1, $2, $3, NULL, $4, 0, $5, $6, $7, 'settled')`,
    [investmentSaleId, accountId, transactionId, unit, averageCost, realizedPl, date]
  );

  return { transactionId, investmentSaleId, averageCost };
}

// price_per_unit = 0 adalah ciri KHUSUS write-off (selalu diisi 0, lihat
// INSERT di applyWriteOffInvestmentTransaction di atas) -- BEDA dari jual
// biasa yang price_per_unit WAJIB diisi & positive (schema.ts form jual).
// `adjustment_transaction_id IS NULL` SENDIRIAN tidak cukup: jual biasa
// yang kebetulan realizedPl == 0 (harga jual == average cost saat itu)
// JUGA tidak punya leg kedua (lihat createAdjustmentTransaction: cuma
// insert kalau realizedPl !== 0), jadi harus dikombinasikan dgn
// price_per_unit = 0 supaya tidak salah kenali jual biasa sbg write-off.
async function getTransactionWriteOffSale(
  db: Db,
  transactionId: string
): Promise<{ id: string; unit: number } | null> {
  const rows = await db.select<{ id: string; unit: number }[]>(
    "SELECT id, unit FROM investment_sales WHERE transaction_id = $1 AND price_per_unit = 0",
    [transactionId]
  );
  return rows[0] ?? null;
}

export type ApplyWriteOffInvestmentTransactionEditInput = {
  db: Db;
  transactionId: string;
  accountId: string;
  unit: number;
};

export type WriteOffInvestmentTransactionEditResult = {
  /** `amount` baru yang HARUS ditulis ke `transactions.amount` oleh
   * caller — write-off bukan nominal bebas dari form, selalu
   * `averageCost × unit` (lihat komentar `applyWriteOffInvestmentTransaction`
   * di atas), dan `averageCost` bisa sudah bergeser sejak baris ini
   * pertama dibuat (pembelian baru masuk, dst) — dihitung ULANG di titik
   * edit ini, bukan dipakai dari nilai lama. */
  amount: number;
  averageCost: number;
};

/**
 * Versi `applyWriteOffInvestmentTransaction` untuk jalur EDIT transaksi —
 * dipanggil dari form transaksi UTAMA (`use-update-transaction.ts`) saat
 * transaksi yang diedit terdeteksi sebagai write-off (baris
 * `investment_sales` dengan `adjustment_transaction_id IS NULL`, ciri
 * yang membedakannya dari jual biasa — lihat `getTransactionWriteOffSale`).
 *
 * BEDA dari `applySellInvestmentTransactionEdit` (jual, apply-sell-
 * investment-transaction.ts): write-off TIDAK PERNAH punya leg
 * penyesuaian P/L di akun kas (`adjustment_transaction_id` selalu NULL —
 * seluruh P/L negatif sudah tercermin di SATU transaksi `expense` pada
 * akun investment itu sendiri), jadi tidak ada transaksi kedua yang perlu
 * dihapus/dibuat ulang. UPDATE in-place pada baris yang sama (bukan
 * delete+recreate seperti pola `investment_purchases`/jual) karena id
 * baris ini tidak dipakai di mana pun selain `transaction_id` (tidak ada
 * baris anak yang bergantung, sama seperti `investment_purchases`).
 *
 * Validasi oversell (unit baru > sisa unit) TETAP tanggung jawab CALLER
 * (pola sama arah jual di `use-update-transaction.ts`: unit LAMA baris ini
 * harus dikompensasi balik ke `remainingUnit` dulu sebelum dibandingkan,
 * karena baris ini sendiri sudah ikut mengurangi holding sejak dibuat) —
 * fungsi ini cuma eksekusi, tidak menolak oversell sendiri.
 */
export async function applyWriteOffInvestmentTransactionEdit({
  db,
  transactionId,
  accountId,
  unit,
}: ApplyWriteOffInvestmentTransactionEditInput): Promise<WriteOffInvestmentTransactionEditResult> {
  const existing = await getTransactionWriteOffSale(db, transactionId);
  if (existing == null) {
    throw new Error("Baris write-off investasi untuk transaksi ini tidak ditemukan.");
  }

  const averageCost = await getAverageCostPerUnit(db, accountId);
  const amount = averageCost * unit;
  const realizedPl = -amount;

  await db.execute(
    "UPDATE investment_sales SET unit = $1, average_cost_per_unit = $2, realized_pl = $3 WHERE id = $4",
    [unit, averageCost, realizedPl, existing.id]
  );

  return { amount, averageCost };
}

/** Deteksi "transaksi ini adalah write-off investasi" — dipakai
 * `use-update-transaction.ts` SEBELUM memutuskan cabang edit mana yang
 * dipanggil (direct-purchase vs write-off vs transfer biasa). Lihat
 * komentar `getTransactionWriteOffSale` di atas untuk kriterianya
 * (`price_per_unit = 0`, bukan `adjustment_transaction_id IS NULL` saja). */
export async function getTransactionWriteOff(
  db: Db,
  transactionId: string
): Promise<{ id: string; unit: number } | null> {
  return getTransactionWriteOffSale(db, transactionId);
}
