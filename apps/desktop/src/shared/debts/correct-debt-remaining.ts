import { getDb, type Debt } from "@/lib/db";
import { newId } from "@/lib/id";

type Db = Awaited<ReturnType<typeof getDb>>;

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
};

export class DebtRemainingCorrectionNoopError extends Error {
  constructor() {
    super("Sisa yang diinput sama dengan sisa saat ini -- tidak ada yang perlu dikoreksi.");
    this.name = "DebtRemainingCorrectionNoopError";
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

    if (targetRemaining <= 0) {
      await db.execute("UPDATE debts SET status = 'paid' WHERE id = $1", [debt.id]);
    }

    return { transactionId, direction: "decrease", diff, debtPaymentId };
  }

  await db.execute("UPDATE debts SET amount = amount + $1 WHERE id = $2", [diff, debt.id]);

  return { transactionId, direction: "increase", diff, debtPaymentId: null };
}
