import { getDb, type Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { getAverageCostPerUnit, getRemainingUnit } from "./investment-holding-math";

type Db = Awaited<ReturnType<typeof getDb>>;

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

export type ApplyInvestmentBalanceCorrectionInput = {
  db: Db;
  accountId: string;
  getCategoryId: (type: "income" | "expense") => Promise<string | null>;
  date: string;
  note: string;
  unit: number;
  pricePerUnit: number;
};

export type InvestmentBalanceCorrectionResult = {
  transactionId: string;
  direction: "purchase" | "sale";
  investmentPurchaseId: string | null;
  investmentSaleId: string | null;
  diffUnit: number;
  amount: number;
};

export class InvestmentBalanceCorrectionNoopError extends Error {
  constructor() {
    super("Unit yang diinput sama dengan sisa unit saat ini -- tidak ada yang perlu dikoreksi.");
    this.name = "InvestmentBalanceCorrectionNoopError";
  }
}

export class InvestmentBalanceCorrectionMismatchError extends Error {
  constructor(expectedUnit: number, actualUnit: number) {
    super(
      `Koreksi saldo investasi gagal -- ditemukan inkonsistensi internal (sisa unit seharusnya ${expectedUnit}, hasil hitung ulang ${actualUnit}). Perubahan dibatalkan, tidak ada data yang tersimpan.`
    );
    this.name = "InvestmentBalanceCorrectionMismatchError";
  }
}

export async function applyInvestmentBalanceCorrection({
  db,
  accountId,
  getCategoryId,
  date,
  note,
  unit,
  pricePerUnit,
}: ApplyInvestmentBalanceCorrectionInput): Promise<InvestmentBalanceCorrectionResult> {
  const accountType = await getAccountType(db, accountId);
  if (accountType !== "investment") {
    throw new Error("Akun koreksi saldo investasi harus bertipe 'investment'.");
  }

  const currentUnit = await getRemainingUnit(db, accountId);
  const diffUnit = unit - currentUnit;
  if (diffUnit === 0) {
    throw new InvestmentBalanceCorrectionNoopError();
  }

  const amount = pricePerUnit * Math.abs(diffUnit);
  const type: "income" | "expense" = diffUnit > 0 ? "income" : "expense";
  const categoryId = await getCategoryId(type);

  const transactionId = newId();
  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, note, date, is_cash_neutral)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
    [transactionId, type, amount, categoryId, accountId, note, date]
  );

  if (diffUnit > 0) {
    const investmentPurchaseId = newId();
    await db.execute(
      `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'settled')`,
      [investmentPurchaseId, accountId, transactionId, diffUnit, pricePerUnit, date]
    );

    const actualUnit = await getRemainingUnit(db, accountId);
    if (actualUnit !== unit) {
      await db.execute("DELETE FROM investment_purchases WHERE id = $1", [investmentPurchaseId]);
      await db.execute("DELETE FROM transactions WHERE id = $1", [transactionId]);
      throw new InvestmentBalanceCorrectionMismatchError(unit, actualUnit);
    }

    return {
      transactionId,
      direction: "purchase",
      investmentPurchaseId,
      investmentSaleId: null,
      diffUnit,
      amount,
    };
  }

  const soldUnit = Math.abs(diffUnit);
  const averageCost = await getAverageCostPerUnit(db, accountId);
  const realizedPl = (pricePerUnit - averageCost) * soldUnit;

  const investmentSaleId = newId();
  await db.execute(
    `INSERT INTO investment_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, 'settled')`,
    [investmentSaleId, accountId, transactionId, soldUnit, pricePerUnit, averageCost, realizedPl, date]
  );

  const actualUnit = await getRemainingUnit(db, accountId);
  if (actualUnit !== unit) {
    await db.execute("DELETE FROM investment_sales WHERE id = $1", [investmentSaleId]);
    await db.execute("DELETE FROM transactions WHERE id = $1", [transactionId]);
    throw new InvestmentBalanceCorrectionMismatchError(unit, actualUnit);
  }

  return {
    transactionId,
    direction: "sale",
    investmentPurchaseId: null,
    investmentSaleId,
    diffUnit,
    amount,
  };
}
