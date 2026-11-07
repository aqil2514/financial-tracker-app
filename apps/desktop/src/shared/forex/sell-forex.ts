import type { getDb } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import { newId } from "@/lib/id";
import { getForexAverageCostPerUnit, getForexRemainingUnit } from "./forex-holding-math";

type Db = Awaited<ReturnType<typeof getDb>>;

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
  db: Db;
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

// Dua transaksi, pola sama investment_sales: transfer valas -> kas senilai average cost × unit
// (balance valas berkurang sebesar modal yang dilepas, bukan nominal jual), plus income/expense
// di akun kas senilai selisih kurs, supaya kas menerima nominal jual penuh.
export async function sellForex({
  db,
  forexAccountId,
  cashAccountId,
  unit,
  rate,
  date,
  note,
}: SellForexInput): Promise<SellForexResult> {
  if (!(unit > 0)) throw new Error("Jumlah unit harus lebih dari 0.");
  if (!(rate > 0)) throw new Error("Kurs harus lebih dari 0.");

  if ((await getAccountType(db, forexAccountId)) !== "forex") {
    throw new Error("Akun sumber penjualan harus bertipe Valas.");
  }
  if ((await getAccountType(db, cashAccountId)) !== "cash") {
    throw new Error("Akun tujuan penjualan harus bertipe Kas.");
  }

  const remainingUnit = await getForexRemainingUnit(db, forexAccountId);
  if (unit > remainingUnit) throw new InsufficientForexUnitsError(remainingUnit, unit);

  const averageCost = await getForexAverageCostPerUnit(db, forexAccountId);
  const realizedPl = (rate - averageCost) * unit;

  const transactionId = newId();
  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
     VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6)`,
    [transactionId, averageCost * unit, forexAccountId, cashAccountId, note, date]
  );

  let adjustmentTransactionId: string | null = null;
  if (Math.abs(realizedPl) >= PL_EPSILON) {
    adjustmentTransactionId = newId();
    await db.execute(
      `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
       VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, $6)`,
      [
        adjustmentTransactionId,
        realizedPl > 0 ? "income" : "expense",
        Math.abs(realizedPl),
        cashAccountId,
        "Realized P/L penjualan valas",
        date,
      ]
    );
  }

  const saleId = newId();
  await db.execute(
    `INSERT INTO forex_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, rate, average_cost_per_unit, realized_pl, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [saleId, forexAccountId, transactionId, adjustmentTransactionId, unit, rate, averageCost, realizedPl, date]
  );

  return { saleId, transactionId, adjustmentTransactionId, realizedPl };
}
