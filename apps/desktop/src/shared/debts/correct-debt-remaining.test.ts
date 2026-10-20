import { describe, expect, it } from "vitest";

import {
  correctDebtRemaining,
  DebtRemainingCorrectionMismatchError,
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
type DebtAmountAdjustmentRow = { id: string; debt_id: string; transaction_id: string; delta: number };
type DebtRow = { id: string; amount: number; status: "ongoing" | "paid" | "written_off" };

function createFakeDb(seed: { debt: DebtRow }) {
  const debt = { ...seed.debt };
  const transactions: TransactionRow[] = [];
  const debtPayments: DebtPaymentRow[] = [];
  const debtAmountAdjustments: DebtAmountAdjustmentRow[] = [];

  const db = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      if (sql.includes("remaining") && sql.includes("FROM debts WHERE debts.id")) {
        const [id] = params as [string];
        if (id !== debt.id) return [] as T;
        const paid = debtPayments.filter((p) => p.debt_id === id).reduce((sum, p) => sum + p.amount, 0);
        return [{ remaining: debt.amount - paid }] as T;
      }
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
      if (sql.startsWith("UPDATE debts SET status = 'paid'")) {
        const [id] = params as [string];
        if (id === debt.id) debt.status = "paid";
        return {};
      }
      if (sql.startsWith("UPDATE debts SET status = 'ongoing'")) {
        const [id] = params as [string];
        if (id === debt.id) debt.status = "ongoing";
        return {};
      }
      if (sql.startsWith("UPDATE debts SET amount = amount +")) {
        const [delta, id] = params as [number, string];
        if (id === debt.id) debt.amount += delta;
        return {};
      }
      if (sql.startsWith("UPDATE debts SET amount = amount -")) {
        const [delta, id] = params as [number, string];
        if (id === debt.id) debt.amount -= delta;
        return {};
      }
      if (sql.startsWith("INSERT INTO debt_amount_adjustments")) {
        const [id, debtId, transactionId, delta] = params as [string, string, string, number];
        debtAmountAdjustments.push({ id, debt_id: debtId, transaction_id: transactionId, delta });
        return {};
      }
      if (sql.startsWith("DELETE FROM debt_amount_adjustments WHERE id")) {
        const [id] = params as [string];
        const index = debtAmountAdjustments.findIndex((a) => a.id === id);
        if (index >= 0) debtAmountAdjustments.splice(index, 1);
        return {};
      }
      if (sql.startsWith("DELETE FROM debt_payments WHERE id")) {
        const [id] = params as [string];
        const index = debtPayments.findIndex((p) => p.id === id);
        if (index >= 0) debtPayments.splice(index, 1);
        return {};
      }
      if (sql.startsWith("DELETE FROM transactions WHERE id")) {
        const [id] = params as [string];
        const index = transactions.findIndex((t) => t.id === id);
        if (index >= 0) transactions.splice(index, 1);
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return {
    db: db as unknown as CorrectDebtRemainingInput["db"],
    transactions,
    debtPayments,
    debtAmountAdjustments,
    debt,
  };
}

describe("correctDebtRemaining", () => {
  it("sisa seharusnya lebih kecil (receivable) -> transaksi expense, insert debt_payments", async () => {
    const { db, transactions, debtPayments } = createFakeDb({
      debt: { id: "debt1", amount: 100_000, status: "ongoing" },
    });

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
  });

  it("sisa seharusnya jadi 0 (receivable) -> status di-update jadi paid", async () => {
    const { db, debt } = createFakeDb({ debt: { id: "debt1", amount: 100_000, status: "ongoing" } });

    await correctDebtRemaining({
      db,
      debt: { id: "debt1", type: "receivable", account_id: "acc1", contact_id: "contact1" },
      currentRemaining: 100_000,
      targetRemaining: 0,
      date: "2026-10-20",
      note: "x",
    });

    expect(debt.status).toBe("paid");
  });

  it("sisa seharusnya lebih kecil (payable) -> transaksi income, insert debt_payments", async () => {
    const { db, transactions } = createFakeDb({ debt: { id: "debt1", amount: 100_000, status: "ongoing" } });

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

  it("sisa seharusnya lebih besar (receivable) -> transaksi income, UPDATE debts.amount, insert debt_amount_adjustments", async () => {
    const { db, transactions, debtPayments, debtAmountAdjustments, debt } = createFakeDb({
      debt: { id: "debt1", amount: 100_000, status: "ongoing" },
    });

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
    expect(debt.amount).toBe(150_000);
    expect(debtAmountAdjustments).toHaveLength(1);
    expect(debtAmountAdjustments[0]).toMatchObject({
      debt_id: "debt1",
      transaction_id: transactions[0].id,
      delta: 50_000,
    });
    expect(result.debtAmountAdjustmentId).toBe(debtAmountAdjustments[0].id);
  });

  it("sisa seharusnya lebih besar (payable) -> transaksi expense, UPDATE debts.amount", async () => {
    const { db, transactions, debt } = createFakeDb({ debt: { id: "debt1", amount: 100_000, status: "ongoing" } });

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
    expect(debt.amount).toBe(120_000);
  });

  it("menolak kalau sisa seharusnya sama dengan sisa saat ini", async () => {
    const { db } = createFakeDb({ debt: { id: "debt1", amount: 100_000, status: "ongoing" } });

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
    const { db } = createFakeDb({ debt: { id: "debt1", amount: 100_000, status: "ongoing" } });

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

  it("rollback manual (DELETE + revert status) kalau hasil hitung ulang remaining tidak cocok, arah turun", async () => {
    const { db, transactions, debtPayments, debt } = createFakeDb({
      debt: { id: "debt1", amount: 100_000, status: "ongoing" },
    });

    const originalExecute = db.execute.bind(db);
    db.execute = async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("INSERT INTO debt_payments")) {
        const result = await originalExecute(sql, params);
        debtPayments.push({ id: "ghost", debt_id: "debt1", amount: 999_999, transaction_id: "ghost-tx" });
        return result;
      }
      return originalExecute(sql, params);
    };

    await expect(
      correctDebtRemaining({
        db,
        debt: { id: "debt1", type: "receivable", account_id: "acc1", contact_id: "contact1" },
        currentRemaining: 100_000,
        targetRemaining: 0,
        date: "2026-10-20",
        note: "x",
      })
    ).rejects.toThrow(DebtRemainingCorrectionMismatchError);

    expect(debt.status).toBe("ongoing");
    expect(transactions).toHaveLength(0);
    expect(debtPayments.find((p) => p.id !== "ghost")).toBeUndefined();
  });

  it("rollback manual (revert amount) kalau hasil hitung ulang remaining tidak cocok, arah naik", async () => {
    const { db, transactions, debtPayments, debtAmountAdjustments, debt } = createFakeDb({
      debt: { id: "debt1", amount: 100_000, status: "ongoing" },
    });

    const originalExecute = db.execute.bind(db);
    db.execute = async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("UPDATE debts SET amount = amount +")) {
        const result = await originalExecute(sql, params);
        debtPayments.push({ id: "ghost", debt_id: "debt1", amount: 1, transaction_id: "ghost-tx" });
        return result;
      }
      return originalExecute(sql, params);
    };

    await expect(
      correctDebtRemaining({
        db,
        debt: { id: "debt1", type: "receivable", account_id: "acc1", contact_id: "contact1" },
        currentRemaining: 100_000,
        targetRemaining: 150_000,
        date: "2026-10-20",
        note: "x",
      })
    ).rejects.toThrow(DebtRemainingCorrectionMismatchError);

    expect(debt.amount).toBe(100_000);
    expect(transactions).toHaveLength(0);
    expect(debtAmountAdjustments).toHaveLength(0);
  });
});
