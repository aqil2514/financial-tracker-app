import { describe, expect, it } from "vitest";

import {
  applyInvestmentBalanceCorrection,
  InvestmentBalanceCorrectionMismatchError,
  InvestmentBalanceCorrectionNoopError,
  type ApplyInvestmentBalanceCorrectionInput,
} from "./apply-investment-balance-correction";

type AccountRow = { id: string; account_type: "cash" | "debt" | "investment" };
type InvestmentPurchaseRow = {
  id: string;
  account_id: string;
  transaction_id: string;
  unit: number | null;
  price_per_unit: number | null;
  status: "pending" | "settled";
};
type InvestmentSaleRow = {
  id: string;
  account_id: string;
  transaction_id: string;
  unit: number;
  price_per_unit: number;
  average_cost_per_unit: number;
  realized_pl: number;
  status: "pending" | "settled";
};
type TransactionRow = { id: string; type: string; amount: number; account_id: string };

function createFakeDb(seed: {
  accounts?: AccountRow[];
  investmentPurchases?: InvestmentPurchaseRow[];
  investmentSales?: InvestmentSaleRow[];
}) {
  const accounts = seed.accounts ?? [];
  const investmentPurchases: InvestmentPurchaseRow[] = seed.investmentPurchases ?? [];
  const investmentSales: InvestmentSaleRow[] = seed.investmentSales ?? [];
  const transactions: TransactionRow[] = [];

  const db = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      if (sql.includes("FROM accounts WHERE id")) {
        const [id] = params as [string];
        const account = accounts.find((a) => a.id === id);
        return (account ? [{ account_type: account.account_type }] : []) as T;
      }
      if (sql.includes("SUM(unit * price_per_unit)") && sql.includes("investment_purchases")) {
        const [accountId] = params as [string];
        const rows = investmentPurchases.filter((p) => p.account_id === accountId && p.status === "settled");
        const totalUnit = rows.reduce((sum, r) => sum + (r.unit ?? 0), 0);
        const totalCost = rows.reduce((sum, r) => sum + (r.unit ?? 0) * (r.price_per_unit ?? 0), 0);
        return [{ total_cost: totalCost, total_unit: totalUnit }] as T;
      }
      if (sql.includes("SUM(unit)") && sql.includes("FROM investment_purchases") && sql.includes("settled")) {
        const [accountId] = params as [string];
        const rows = investmentPurchases.filter((p) => p.account_id === accountId && p.status === "settled");
        return [{ total_unit: rows.reduce((sum, r) => sum + (r.unit ?? 0), 0) }] as T;
      }
      if (sql.includes("SUM(unit)") && sql.includes("FROM investment_sales")) {
        const [accountId] = params as [string];
        const rows = investmentSales.filter((s) => s.account_id === accountId);
        return [{ total_unit: rows.reduce((sum, r) => sum + r.unit, 0) }] as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("INSERT INTO transactions")) {
        const [id, type, amount, , accountId] = params as [string, string, number, string | null, string];
        transactions.push({ id, type, amount, account_id: accountId });
        return {};
      }
      if (sql.startsWith("INSERT INTO investment_purchases")) {
        const [id, accountId, transactionId, unit, pricePerUnit] = params as [
          string,
          string,
          string,
          number,
          number,
        ];
        investmentPurchases.push({
          id,
          account_id: accountId,
          transaction_id: transactionId,
          unit,
          price_per_unit: pricePerUnit,
          status: "settled",
        });
        return {};
      }
      if (sql.startsWith("INSERT INTO investment_sales")) {
        const [id, accountId, transactionId, unit, pricePerUnit, averageCost, realizedPl] = params as [
          string,
          string,
          string,
          number,
          number,
          number,
          number,
        ];
        investmentSales.push({
          id,
          account_id: accountId,
          transaction_id: transactionId,
          unit,
          price_per_unit: pricePerUnit,
          average_cost_per_unit: averageCost,
          realized_pl: realizedPl,
          status: "settled",
        });
        return {};
      }
      if (sql.startsWith("DELETE FROM investment_purchases WHERE id")) {
        const [id] = params as [string];
        const index = investmentPurchases.findIndex((p) => p.id === id);
        if (index >= 0) investmentPurchases.splice(index, 1);
        return {};
      }
      if (sql.startsWith("DELETE FROM investment_sales WHERE id")) {
        const [id] = params as [string];
        const index = investmentSales.findIndex((s) => s.id === id);
        if (index >= 0) investmentSales.splice(index, 1);
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
    db: db as unknown as ApplyInvestmentBalanceCorrectionInput["db"],
    transactions,
    investmentPurchases,
    investmentSales,
  };
}

describe("applyInvestmentBalanceCorrection", () => {
  it("unit seharusnya lebih besar dari sisa unit sekarang -> insert investment_purchases, transaksi income cash-neutral", async () => {
    const { db, transactions, investmentPurchases, investmentSales } = createFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [
        { id: "p1", account_id: "inv1", transaction_id: "tx0", unit: 100, price_per_unit: 1000, status: "settled" },
      ],
    });

    const result = await applyInvestmentBalanceCorrection({
      db,
      accountId: "inv1",
      getCategoryId: async () => null,
      date: "2026-10-20",
      note: "Koreksi saldo",
      unit: 120,
      pricePerUnit: 1500,
    });

    expect(result).toMatchObject({ direction: "purchase", diffUnit: 20, amount: 30_000 });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ type: "income", amount: 30_000, account_id: "inv1" });
    expect(investmentPurchases).toHaveLength(2);
    expect(investmentPurchases[1]).toMatchObject({
      account_id: "inv1",
      transaction_id: transactions[0].id,
      unit: 20,
      price_per_unit: 1500,
      status: "settled",
    });
    expect(investmentSales).toHaveLength(0);
  });

  it("unit seharusnya lebih kecil dari sisa unit sekarang -> insert investment_sales manual, transaksi expense cash-neutral", async () => {
    const { db, transactions, investmentPurchases, investmentSales } = createFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [
        { id: "p1", account_id: "inv1", transaction_id: "tx0", unit: 100, price_per_unit: 1000, status: "settled" },
      ],
    });

    const result = await applyInvestmentBalanceCorrection({
      db,
      accountId: "inv1",
      getCategoryId: async () => null,
      date: "2026-10-20",
      note: "Koreksi saldo",
      unit: 95,
      pricePerUnit: 800,
    });

    expect(result).toMatchObject({ direction: "sale", diffUnit: -5, amount: 4_000 });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ type: "expense", amount: 4_000, account_id: "inv1" });
    expect(investmentPurchases).toHaveLength(1);
    expect(investmentSales).toHaveLength(1);
    expect(investmentSales[0]).toMatchObject({
      account_id: "inv1",
      transaction_id: transactions[0].id,
      unit: 5,
      price_per_unit: 800,
      average_cost_per_unit: 1000,
      realized_pl: -1_000,
      status: "settled",
    });
  });

  it("menolak kalau unit seharusnya sama dengan sisa unit sekarang (tidak ada yang dikoreksi)", async () => {
    const { db } = createFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [
        { id: "p1", account_id: "inv1", transaction_id: "tx0", unit: 100, price_per_unit: 1000, status: "settled" },
      ],
    });

    await expect(
      applyInvestmentBalanceCorrection({
        db,
        accountId: "inv1",
        getCategoryId: async () => null,
        date: "2026-10-20",
        note: "x",
        unit: 100,
        pricePerUnit: 1000,
      })
    ).rejects.toThrow(InvestmentBalanceCorrectionNoopError);
  });

  it("menolak kalau akun bukan bertipe investment", async () => {
    const { db } = createFakeDb({ accounts: [{ id: "cash1", account_type: "cash" }] });

    await expect(
      applyInvestmentBalanceCorrection({
        db,
        accountId: "cash1",
        getCategoryId: async () => null,
        date: "2026-10-20",
        note: "x",
        unit: 10,
        pricePerUnit: 1000,
      })
    ).rejects.toThrow("Akun koreksi saldo investasi harus bertipe 'investment'.");
  });

  it("memperhitungkan unit yang sudah terjual sebelumnya saat menghitung sisa unit sekarang", async () => {
    const { db, investmentSales } = createFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [
        { id: "p1", account_id: "inv1", transaction_id: "tx0", unit: 100, price_per_unit: 1000, status: "settled" },
      ],
      investmentSales: [
        {
          id: "s1",
          account_id: "inv1",
          transaction_id: "tx1",
          unit: 30,
          price_per_unit: 1100,
          average_cost_per_unit: 1000,
          realized_pl: 3000,
          status: "settled",
        },
      ],
    });

    const result = await applyInvestmentBalanceCorrection({
      db,
      accountId: "inv1",
      getCategoryId: async () => null,
      date: "2026-10-20",
      note: "x",
      unit: 60,
      pricePerUnit: 900,
    });

    expect(result).toMatchObject({ direction: "sale", diffUnit: -10 });
    expect(investmentSales[1]).toMatchObject({ unit: 10, average_cost_per_unit: 1000 });
  });

  it("rollback manual (DELETE) kalau hasil hitung ulang remainingUnit tidak cocok dengan unit yang diminta, arah tambah", async () => {
    const { db, transactions, investmentPurchases } = createFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [
        { id: "p1", account_id: "inv1", transaction_id: "tx0", unit: 100, price_per_unit: 1000, status: "settled" },
      ],
    });

    const originalExecute = db.execute.bind(db);
    db.execute = async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("INSERT INTO investment_purchases")) {
        const result = await originalExecute(sql, params);
        investmentPurchases.push({
          id: "ghost",
          account_id: "inv1",
          transaction_id: "ghost-tx",
          unit: 999,
          price_per_unit: 1,
          status: "settled",
        });
        return result;
      }
      return originalExecute(sql, params);
    };

    await expect(
      applyInvestmentBalanceCorrection({
        db,
        accountId: "inv1",
        getCategoryId: async () => null,
        date: "2026-10-20",
        note: "x",
        unit: 120,
        pricePerUnit: 1500,
      })
    ).rejects.toThrow(InvestmentBalanceCorrectionMismatchError);

    expect(transactions).toHaveLength(0);
    expect(investmentPurchases.find((p) => p.transaction_id !== "tx0" && p.transaction_id !== "ghost-tx")).toBeUndefined();
  });
});
