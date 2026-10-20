import { describe, expect, it } from "vitest";

import {
  correctDebtRemaining,
  DebtRemainingCorrectionNoopError,
  type CorrectDebtRemainingInput,
} from "./correct-debt-remaining";

type TransactionRow = {
  id: string;
  type: string;
  amount: number;
  account_id: string;
  contact_id: string | null;
  note: string;
  is_cash_neutral: number;
};
type DebtPaymentRow = { id: string; debt_id: string; amount: number; transaction_id: string };
type DebtUpdate = { id: string; status?: string; amountDelta?: number };

function createFakeDb() {
  const transactions: TransactionRow[] = [];
  const debtPayments: DebtPaymentRow[] = [];
  const debtUpdates: DebtUpdate[] = [];

  const db = {
    async select<T>(sql: string): Promise<T> {
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("INSERT INTO transactions")) {
        const [id, type, amount, accountId, note, , contactId] = params as [
          string,
          string,
          number,
          string,
          string,
          string,
          string | null,
        ];
        transactions.push({
          id,
          type,
          amount,
          account_id: accountId,
          contact_id: contactId,
          note,
          is_cash_neutral: 1,
        });
        return {};
      }
      if (sql.startsWith("INSERT INTO debt_payments")) {
        const [id, debtId, amount, , transactionId] = params as [string, string, number, string, string];
        debtPayments.push({ id, debt_id: debtId, amount, transaction_id: transactionId });
        return {};
      }
      if (sql.startsWith("UPDATE debts SET status")) {
        const [id] = params as [string];
        debtUpdates.push({ id, status: "paid" });
        return {};
      }
      if (sql.startsWith("UPDATE debts SET amount")) {
        const [delta, id] = params as [number, string];
        debtUpdates.push({ id, amountDelta: delta });
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db: db as unknown as CorrectDebtRemainingInput["db"], transactions, debtPayments, debtUpdates };
}

describe("correctDebtRemaining", () => {
  it("sisa seharusnya lebih kecil (receivable) -> transaksi expense, insert debt_payments", async () => {
    const { db, transactions, debtPayments, debtUpdates } = createFakeDb();

    const result = await correctDebtRemaining({
      db,
      debt: { id: "debt1", type: "receivable", account_id: "acc1", contact_id: "contact1" },
      currentRemaining: 100_000,
      targetRemaining: 60_000,
      date: "2026-10-20",
      note: "Koreksi nominal",
    });

    expect(result).toMatchObject({ direction: "decrease", diff: -40_000 });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      type: "expense",
      amount: 40_000,
      account_id: "acc1",
      contact_id: "contact1",
      is_cash_neutral: 1,
    });
    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0]).toMatchObject({ debt_id: "debt1", amount: 40_000, transaction_id: transactions[0].id });
    expect(debtUpdates).toHaveLength(0);
  });

  it("sisa seharusnya jadi 0 (receivable) -> status di-update jadi paid", async () => {
    const { db, debtUpdates } = createFakeDb();

    await correctDebtRemaining({
      db,
      debt: { id: "debt1", type: "receivable", account_id: "acc1", contact_id: "contact1" },
      currentRemaining: 100_000,
      targetRemaining: 0,
      date: "2026-10-20",
      note: "x",
    });

    expect(debtUpdates).toEqual([{ id: "debt1", status: "paid" }]);
  });

  it("sisa seharusnya lebih kecil (payable) -> transaksi income, insert debt_payments", async () => {
    const { db, transactions } = createFakeDb();

    const result = await correctDebtRemaining({
      db,
      debt: { id: "debt1", type: "payable", account_id: "acc1", contact_id: "contact1" },
      currentRemaining: 100_000,
      targetRemaining: 70_000,
      date: "2026-10-20",
      note: "x",
    });

    expect(result).toMatchObject({ direction: "decrease", diff: -30_000 });
    expect(transactions[0]).toMatchObject({ type: "income", amount: 30_000 });
  });

  it("sisa seharusnya lebih besar (receivable) -> transaksi income, UPDATE debts.amount", async () => {
    const { db, transactions, debtPayments, debtUpdates } = createFakeDb();

    const result = await correctDebtRemaining({
      db,
      debt: { id: "debt1", type: "receivable", account_id: "acc1", contact_id: "contact1" },
      currentRemaining: 100_000,
      targetRemaining: 150_000,
      date: "2026-10-20",
      note: "x",
    });

    expect(result).toMatchObject({ direction: "increase", diff: 50_000, debtPaymentId: null });
    expect(transactions[0]).toMatchObject({ type: "income", amount: 50_000 });
    expect(debtPayments).toHaveLength(0);
    expect(debtUpdates).toEqual([{ id: "debt1", amountDelta: 50_000 }]);
  });

  it("sisa seharusnya lebih besar (payable) -> transaksi expense, UPDATE debts.amount", async () => {
    const { db, transactions, debtUpdates } = createFakeDb();

    const result = await correctDebtRemaining({
      db,
      debt: { id: "debt1", type: "payable", account_id: "acc1", contact_id: "contact1" },
      currentRemaining: 100_000,
      targetRemaining: 120_000,
      date: "2026-10-20",
      note: "x",
    });

    expect(result).toMatchObject({ direction: "increase", diff: 20_000 });
    expect(transactions[0]).toMatchObject({ type: "expense", amount: 20_000 });
    expect(debtUpdates).toEqual([{ id: "debt1", amountDelta: 20_000 }]);
  });

  it("menolak kalau sisa seharusnya sama dengan sisa saat ini", async () => {
    const { db } = createFakeDb();

    await expect(
      correctDebtRemaining({
        db,
        debt: { id: "debt1", type: "receivable", account_id: "acc1", contact_id: "contact1" },
        currentRemaining: 100_000,
        targetRemaining: 100_000,
        date: "2026-10-20",
        note: "x",
      })
    ).rejects.toThrow(DebtRemainingCorrectionNoopError);
  });

  it("menolak kalau debt.account_id null (baris dari sync Retailku)", async () => {
    const { db } = createFakeDb();

    await expect(
      correctDebtRemaining({
        db,
        debt: { id: "debt1", type: "receivable", account_id: null, contact_id: "contact1" },
        currentRemaining: 100_000,
        targetRemaining: 50_000,
        date: "2026-10-20",
        note: "x",
      })
    ).rejects.toThrow("Piutang/utang dari sinkronisasi Retailku belum bisa dikoreksi dari sini.");
  });
});
