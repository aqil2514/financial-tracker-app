import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database/generate-id";
import { getForexAverageCostPerUnit, getForexRemainingUnit } from "./forex-holding-math";

export class InsufficientForexUnitsError extends Error {
  constructor(remainingUnit: number, requestedUnit: number) {
    super(
      `Unit yang dijual (${requestedUnit}) melebihi sisa unit yang dimiliki (${remainingUnit}). ` +
        `Kurangi jumlah yang dijual, atau periksa riwayat beli/jual akun ini.`
    );
    this.name = "InsufficientForexUnitsError";
  }
}

export type SellForexInput = {
  db: SQLiteDatabase;
  forexAccountId: string;
  cashAccountId: string;
  unit: number;
  rate: number;
  date: string;
  note: string;
};

export type SellForexResult = {
  saleId: string;
  transactionId: string;
  adjustmentTransactionId: string | null;
  realizedPl: number;
};

// Selisih di bawah ini dianggap nol (noise floating point), tidak membuat transaksi penyesuaian.
const PL_EPSILON = 0.005;
const ADJUSTMENT_NOTE = "Realized P/L penjualan valas";

async function getAccountType(db: SQLiteDatabase, accountId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ account_type: string }>("SELECT account_type FROM accounts WHERE id = ?", [accountId]);
  return row?.account_type ?? null;
}

// Dua transaksi, pola sama investment_sales: transfer valas -> kas senilai average cost × unit (saldo valas turun
// sebesar modal yang dilepas, bukan nominal jual), plus income/expense di akun kas senilai selisih kurs supaya kas
// menerima nominal jual penuh. Semuanya satu transaksi SQLite; cek oversell dilakukan di dalamnya.
export async function sellForex(input: SellForexInput): Promise<SellForexResult> {
  const { db, forexAccountId, cashAccountId, unit, rate, date, note } = input;
  if (!(unit > 0)) throw new Error("Jumlah unit harus lebih dari 0.");
  if (!(rate > 0)) throw new Error("Kurs harus lebih dari 0.");

  if ((await getAccountType(db, forexAccountId)) !== "forex") throw new Error("Akun sumber penjualan harus bertipe Valas.");
  if ((await getAccountType(db, cashAccountId)) !== "cash") throw new Error("Akun tujuan penjualan harus bertipe Kas.");

  let result: SellForexResult | null = null;

  await db.withTransactionAsync(async () => {
    const remainingUnit = await getForexRemainingUnit(db, forexAccountId);
    if (unit > remainingUnit) throw new InsufficientForexUnitsError(remainingUnit, unit);

    const averageCost = await getForexAverageCostPerUnit(db, forexAccountId);
    const realizedPl = (rate - averageCost) * unit;

    const transactionId = generateId();
    await db.runAsync(
      `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
       VALUES (?, ?, NULL, 'transfer', ?, ?, NULL, ?, ?)`,
      [transactionId, note, averageCost * unit, date, forexAccountId, cashAccountId]
    );

    let adjustmentTransactionId: string | null = null;
    if (Math.abs(realizedPl) >= PL_EPSILON) {
      adjustmentTransactionId = generateId();
      await db.runAsync(
        `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
         VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, NULL)`,
        [adjustmentTransactionId, ADJUSTMENT_NOTE, realizedPl > 0 ? "income" : "expense", Math.abs(realizedPl), date, cashAccountId]
      );
    }

    const saleId = generateId();
    await db.runAsync(
      `INSERT INTO forex_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, rate, average_cost_per_unit, realized_pl, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [saleId, forexAccountId, transactionId, adjustmentTransactionId, unit, rate, averageCost, realizedPl, date]
    );

    result = { saleId, transactionId, adjustmentTransactionId, realizedPl };
  });

  return result as unknown as SellForexResult;
}
