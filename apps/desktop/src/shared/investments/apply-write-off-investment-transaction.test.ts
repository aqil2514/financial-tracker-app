import { describe, expect, it } from "vitest";

import {
  applyWriteOffInvestmentTransaction,
  applyWriteOffInvestmentTransactionEdit,
  getTransactionWriteOff,
  type ApplyWriteOffInvestmentTransactionInput,
} from "./apply-write-off-investment-transaction";
import { InsufficientInvestmentUnitsError } from "./apply-sell-investment-transaction";

/**
 * Fake DB in-memory meniru HANYA pola SQL yang dipakai
 * apply-write-off-investment-transaction.ts — pola sama fake db di
 * apply-sell-investment-transaction.test.ts, disederhanakan (tidak perlu
 * simulasi UPDATE/DELETE/leg kedua, write-off cuma 1x INSERT transactions
 * + 1x INSERT investment_sales).
 */
type AccountRow = { id: string; account_type: "cash" | "debt" | "investment" };
type InvestmentPurchaseRow = {
  account_id: string;
  unit: number | null;
  price_per_unit: number | null;
  status: "pending" | "settled";
};
type InvestmentSaleRow = { account_id: string; unit: number; status: "pending" | "settled" };
type TransactionRow = { id: string; type: string; amount: number; account_id: string };

function createFakeDb(seed: {
  accounts?: AccountRow[];
  investmentPurchases?: InvestmentPurchaseRow[];
  investmentSales?: InvestmentSaleRow[];
}) {
  const accounts = seed.accounts ?? [];
  const investmentPurchases = seed.investmentPurchases ?? [];
  const investmentSales: InvestmentSaleRow[] = seed.investmentSales ?? [];
  const transactions: TransactionRow[] = [];
  const insertedSales: { account_id: string; transaction_id: string; unit: number; price_per_unit: number; average_cost_per_unit: number; realized_pl: number; status: string }[] = [];

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
        const [id, amount, accountId] = params as [string, number, string];
        transactions.push({ id, type: "expense", amount, account_id: accountId });
        return {};
      }
      if (sql.startsWith("INSERT INTO investment_sales")) {
        const [id, accountId, transactionId, unit, averageCost, realizedPl] = params as [
          string,
          string,
          string,
          number,
          number,
          number,
        ];
        insertedSales.push({
          account_id: accountId,
          transaction_id: transactionId,
          unit,
          price_per_unit: 0,
          average_cost_per_unit: averageCost,
          realized_pl: realizedPl,
          status: "settled",
        });
        void id;
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db: db as unknown as ApplyWriteOffInvestmentTransactionInput["db"], transactions, insertedSales };
}

describe("applyWriteOffInvestmentTransaction", () => {
  it("membuat transaksi expense pada akun investment sebesar averageCost x unit, dan baris investment_sales dengan realized_pl negatif penuh", async () => {
    const { db, transactions, insertedSales } = createFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [{ account_id: "inv1", unit: 100, price_per_unit: 1000, status: "settled" }],
    });

    const result = await applyWriteOffInvestmentTransaction({
      db,
      accountId: "inv1",
      date: "2026-10-08",
      note: "Dihibahkan ke teman",
      unit: 40,
    });

    expect(result.averageCost).toBe(1000);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ type: "expense", amount: 40_000, account_id: "inv1" });
    expect(insertedSales).toHaveLength(1);
    expect(insertedSales[0]).toMatchObject({
      account_id: "inv1",
      transaction_id: transactions[0].id,
      unit: 40,
      price_per_unit: 0,
      average_cost_per_unit: 1000,
      realized_pl: -40_000,
      status: "settled",
    });
  });

  it("menolak write-off kalau akun bukan bertipe investment", async () => {
    const { db } = createFakeDb({ accounts: [{ id: "cash1", account_type: "cash" }] });

    await expect(
      applyWriteOffInvestmentTransaction({ db, accountId: "cash1", date: "2026-10-08", note: "x", unit: 1 })
    ).rejects.toThrow("Akun write-off harus bertipe 'investment'.");
  });

  it("menolak write-off yang melebihi sisa unit (oversell)", async () => {
    const { db } = createFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [{ account_id: "inv1", unit: 10, price_per_unit: 1000, status: "settled" }],
    });

    await expect(
      applyWriteOffInvestmentTransaction({ db, accountId: "inv1", date: "2026-10-08", note: "x", unit: 20 })
    ).rejects.toThrow(InsufficientInvestmentUnitsError);
  });

  it("memperhitungkan unit yang sudah terjual/write-off sebelumnya (investment_sales) saat validasi sisa unit", async () => {
    const { db } = createFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [{ account_id: "inv1", unit: 100, price_per_unit: 1000, status: "settled" }],
      investmentSales: [{ account_id: "inv1", unit: 70, status: "settled" }],
    });

    await expect(
      applyWriteOffInvestmentTransaction({ db, accountId: "inv1", date: "2026-10-08", note: "x", unit: 40 })
    ).rejects.toThrow(InsufficientInvestmentUnitsError);
  });
});

/**
 * Fake DB KEDUA, khusus utk applyWriteOffInvestmentTransactionEdit/
 * getTransactionWriteOff -- beda kebutuhan dari fake db di atas (perlu
 * `id`+`transaction_id`+`price_per_unit` per baris investment_sales, dan
 * simulasi UPDATE, bukan cuma INSERT). Regresi 2026-10-08 (dogfooding):
 * sama root cause dgn applyInvestmentTransactionEdit (lihat
 * apply-investment-transaction.test.ts) -- transaksi write-off yang
 * diedit lewat form transaksi UTAMA sebelumnya jatuh ke cabang yang salah
 * (applyInvestmentTransactionEdit, utk investment_purchases bukan
 * investment_sales) karena tidak ada deteksi khusus write-off.
 */
type EditInvestmentSaleRow = {
  id: string;
  account_id: string;
  transaction_id: string;
  unit: number;
  price_per_unit: number;
  average_cost_per_unit: number;
  realized_pl: number;
};

function createEditFakeDb(seed: {
  accounts?: AccountRow[];
  investmentPurchases?: InvestmentPurchaseRow[];
  investmentSales?: EditInvestmentSaleRow[];
}) {
  const accounts = seed.accounts ?? [];
  const investmentPurchases = seed.investmentPurchases ?? [];
  const investmentSales: EditInvestmentSaleRow[] = seed.investmentSales ?? [];

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
      if (sql.startsWith("SELECT id, unit FROM investment_sales WHERE transaction_id")) {
        const [transactionId] = params as [string];
        const match = investmentSales.find((s) => s.transaction_id === transactionId && s.price_per_unit === 0);
        return (match ? [{ id: match.id, unit: match.unit }] : []) as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("UPDATE investment_sales SET unit")) {
        const [unit, averageCost, realizedPl, id] = params as [number, number, number, string];
        const row = investmentSales.find((s) => s.id === id);
        if (row) {
          row.unit = unit;
          row.average_cost_per_unit = averageCost;
          row.realized_pl = realizedPl;
        }
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db: db as unknown as ApplyWriteOffInvestmentTransactionInput["db"], investmentSales };
}

describe("applyWriteOffInvestmentTransactionEdit", () => {
  it("UPDATE in-place baris investment_sales yang ada (bukan delete+recreate), amount dihitung ulang dari average cost saat ini", async () => {
    const { db, investmentSales } = createEditFakeDb({
      accounts: [{ id: "inv1", account_type: "investment" }],
      investmentPurchases: [{ account_id: "inv1", unit: 100, price_per_unit: 1000, status: "settled" }],
      investmentSales: [
        {
          id: "sale-1",
          account_id: "inv1",
          transaction_id: "tx-1",
          unit: 40,
          price_per_unit: 0,
          average_cost_per_unit: 1000,
          realized_pl: -40_000,
        },
      ],
    });

    const result = await applyWriteOffInvestmentTransactionEdit({
      db,
      transactionId: "tx-1",
      accountId: "inv1",
      unit: 50,
    });

    expect(result).toMatchObject({ amount: 50_000, averageCost: 1000 });
    expect(investmentSales).toHaveLength(1);
    expect(investmentSales[0]).toMatchObject({
      id: "sale-1",
      unit: 50,
      average_cost_per_unit: 1000,
      realized_pl: -50_000,
    });
  });

  it("melempar error kalau transaksi ini bukan write-off (tidak ada baris investment_sales dengan price_per_unit=0)", async () => {
    const { db } = createEditFakeDb({ accounts: [{ id: "inv1", account_type: "investment" }] });

    await expect(
      applyWriteOffInvestmentTransactionEdit({ db, transactionId: "tx-1", accountId: "inv1", unit: 10 })
    ).rejects.toThrow("Baris write-off investasi untuk transaksi ini tidak ditemukan.");
  });
});

describe("getTransactionWriteOff", () => {
  it("menemukan baris write-off (price_per_unit=0) lewat transactionId", async () => {
    const { db } = createEditFakeDb({
      investmentSales: [
        {
          id: "sale-1",
          account_id: "inv1",
          transaction_id: "tx-1",
          unit: 40,
          price_per_unit: 0,
          average_cost_per_unit: 1000,
          realized_pl: -40_000,
        },
      ],
    });

    const result = await getTransactionWriteOff(db, "tx-1");
    expect(result).toEqual({ id: "sale-1", unit: 40 });
  });

  it("TIDAK mengenali jual biasa (price_per_unit > 0) sebagai write-off, walau adjustment_transaction_id-nya null (realizedPl kebetulan 0)", async () => {
    const { db } = createEditFakeDb({
      investmentSales: [
        {
          id: "sale-1",
          account_id: "inv1",
          transaction_id: "tx-1",
          unit: 40,
          price_per_unit: 1000,
          average_cost_per_unit: 1000,
          realized_pl: 0,
        },
      ],
    });

    const result = await getTransactionWriteOff(db, "tx-1");
    expect(result).toBeNull();
  });

  it("null kalau transaksi tidak punya baris investment_sales sama sekali", async () => {
    const { db } = createEditFakeDb({});

    const result = await getTransactionWriteOff(db, "tx-1");
    expect(result).toBeNull();
  });
});
