import { getDb, type Debt } from "@/lib/db";
import { newId } from "@/lib/id";
import { remainingDebtSql } from "./remaining-debt-sql";

type Db = Awaited<ReturnType<typeof getDb>>;

async function getDebtRemaining(db: Db, debtId: string): Promise<number> {
  const rows = await db.select<{ remaining: number }[]>(
    `SELECT ${remainingDebtSql()} AS remaining FROM debts WHERE debts.id = $1`,
    [debtId]
  );
  return rows[0]?.remaining ?? 0;
}

export type CorrectDebtRemainingInput = {
  db: Db;
  debt: Pick<Debt, "id" | "type" | "account_id" | "contact_id">;
  currentRemaining: number;
  targetRemaining: number;
  date: string;
  note: string;
};

export type CorrectDebtRemainingResult = {
  transactionId: string;
  direction: "increase" | "decrease";
  diff: number;
  debtPaymentId: string | null;
  debtAmountAdjustmentId: string | null;
};

export class DebtRemainingCorrectionNoopError extends Error {
  constructor() {
    super("Sisa yang diinput sama dengan sisa saat ini -- tidak ada yang perlu dikoreksi.");
    this.name = "DebtRemainingCorrectionNoopError";
  }
}

export class DebtRemainingCorrectionMismatchError extends Error {
  constructor(expectedRemaining: number, actualRemaining: number) {
    super(
      `Koreksi nominal gagal -- ditemukan inkonsistensi internal (sisa seharusnya ${expectedRemaining}, hasil hitung ulang ${actualRemaining}). Perubahan dibatalkan, tidak ada data yang tersimpan.`
    );
    this.name = "DebtRemainingCorrectionMismatchError";
  }
}

export async function correctDebtRemaining({
  db,
  debt,
  currentRemaining,
  targetRemaining,
  date,
  note,
}: CorrectDebtRemainingInput): Promise<CorrectDebtRemainingResult> {
  if (debt.account_id == null) {
    throw new Error("Piutang/utang dari sinkronisasi Retailku belum bisa dikoreksi dari sini.");
  }

  const diff = targetRemaining - currentRemaining;
  if (diff === 0) {
    throw new DebtRemainingCorrectionNoopError();
  }

  const isDecrease = diff < 0;
  const amount = Math.abs(diff);
  const transactionType: "income" | "expense" = isDecrease
    ? debt.type === "receivable"
      ? "expense"
      : "income"
    : debt.type === "receivable"
      ? "income"
      : "expense";

  const transactionId = newId();
  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id, is_cash_neutral)
     VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, $6, $7, 1)`,
    [transactionId, transactionType, amount, debt.account_id, note, date, debt.contact_id]
  );

  if (isDecrease) {
    const debtPaymentId = newId();
    await db.execute(
      `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [debtPaymentId, debt.id, amount, debt.account_id, transactionId, date, note]
    );

    const statusShouldBePaid = targetRemaining <= 0;
    if (statusShouldBePaid) {
      await db.execute("UPDATE debts SET status = 'paid' WHERE id = $1", [debt.id]);
    }

    const actualRemaining = await getDebtRemaining(db, debt.id);
    if (actualRemaining !== targetRemaining) {
      if (statusShouldBePaid) {
        await db.execute("UPDATE debts SET status = 'ongoing' WHERE id = $1", [debt.id]);
      }
      await db.execute("DELETE FROM debt_payments WHERE id = $1", [debtPaymentId]);
      await db.execute("DELETE FROM transactions WHERE id = $1", [transactionId]);
      throw new DebtRemainingCorrectionMismatchError(targetRemaining, actualRemaining);
    }

    return { transactionId, direction: "decrease", diff, debtPaymentId, debtAmountAdjustmentId: null };
  }

  await db.execute("UPDATE debts SET amount = amount + $1 WHERE id = $2", [diff, debt.id]);

  const debtAmountAdjustmentId = newId();
  await db.execute(
    `INSERT INTO debt_amount_adjustments (id, debt_id, transaction_id, delta, date)
     VALUES ($1, $2, $3, $4, $5)`,
    [debtAmountAdjustmentId, debt.id, transactionId, diff, date]
  );

  const actualRemaining = await getDebtRemaining(db, debt.id);
  if (actualRemaining !== targetRemaining) {
    await db.execute("DELETE FROM debt_amount_adjustments WHERE id = $1", [debtAmountAdjustmentId]);
    await db.execute("UPDATE debts SET amount = amount - $1 WHERE id = $2", [diff, debt.id]);
    await db.execute("DELETE FROM transactions WHERE id = $1", [transactionId]);
    throw new DebtRemainingCorrectionMismatchError(targetRemaining, actualRemaining);
  }

  return { transactionId, direction: "increase", diff, debtPaymentId: null, debtAmountAdjustmentId };
}
