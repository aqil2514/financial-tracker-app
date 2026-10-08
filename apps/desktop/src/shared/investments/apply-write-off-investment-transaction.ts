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
