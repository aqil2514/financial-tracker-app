import { describe, expect, it } from "vitest";

import {
  applyInvestmentTransaction,
  applyInvestmentTransactionEdit,
  detachInvestmentPurchaseForDeletedTransaction,
  InvestmentPurchaseEditBlockedError,
} from "./index";

type AccountRow = { id: string; account_type: "cash" | "debt" | "investment" };
type InvestmentPurchaseRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  unit: number | null;
  price_per_unit: number | null;
  date: string;
  status: "pending" | "settled";
};
type InvestmentSaleRow = { account_id: string; unit: number; status: "pending" | "settled" };

function createFakeDb(
  seed: {
    accounts?: AccountRow[];
    investmentPurchases?: InvestmentPurchaseRow[];
    investmentSales?: InvestmentSaleRow[];
  } = {}
) {
  const accounts = seed.accounts ?? [];
  const investmentPurchases: InvestmentPurchaseRow[] = seed.investmentPurchases ?? [];
  const investmentSales: InvestmentSaleRow[] = seed.investmentSales ?? [];

  const db = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      if (sql.includes("FROM accounts WHERE id")) {
        const [id] = params as [string];
        const account = accounts.find((a) => a.id === id);
        return (account ? [{ account_type: account.account_type }] : []) as T;
      }
      if (
        sql.startsWith("SELECT id, account_id, unit, price_per_unit, status FROM investment_purchases WHERE transaction_id")
      ) {
        const [transactionId] = params as [string];
        const match = investmentPurchases.find((p) => p.transaction_id === transactionId);
        return (
          match
            ? [
                {
                  id: match.id,
                  account_id: match.account_id,
                  unit: match.unit,
                  price_per_unit: match.price_per_unit,
                  status: match.status,
                },
              ]
            : []
        ) as T;
      }
      if (sql.startsWith("SELECT id FROM investment_purchases WHERE transaction_id")) {
        const [transactionId] = params as [string];
        const match = investmentPurchases.find((p) => p.transaction_id === transactionId);
        return (match ? [{ id: match.id }] : []) as T;
      }
      if (sql.includes("SUM(unit) AS total_unit FROM investment_purchases WHERE account_id")) {
        const [accountId] = params as [string];
        const total = investmentPurchases
          .filter((p) => p.account_id === accountId && p.status === "settled")
          .reduce((sum, p) => sum + (p.unit ?? 0), 0);
        return [{ total_unit: total }] as T;
      }
      if (sql.includes("SUM(unit) AS total_unit FROM investment_sales WHERE account_id")) {
        const [accountId] = params as [string];
        const total = investmentSales
          .filter((s) => s.account_id === accountId)
          .reduce((sum, s) => sum + s.unit, 0);
        return [{ total_unit: total }] as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("INSERT INTO investment_purchases")) {
        const [id, accountId, transactionId, unit, pricePerUnit, date, status] = params as [
          string,
          string,
          string,
          number | null,
          number | null,
          string,
          "pending" | "settled",
        ];
        investmentPurchases.push({
          id,
          account_id: accountId,
          transaction_id: transactionId,
          unit,
          price_per_unit: pricePerUnit,
          date,
          status,
        });
        return {};
      }
      if (sql.startsWith("DELETE FROM investment_purchases")) {
        const [id] = params as [string];
        const index = investmentPurchases.findIndex((p) => p.id === id);
        if (index >= 0) investmentPurchases.splice(index, 1);
        return {};
      }
      if (sql.startsWith("UPDATE investment_purchases SET unit")) {
        const [unit, pricePerUnit, date, id] = params as [number | null, number | null, string, string];
        const row = investmentPurchases.find((p) => p.id === id);
        if (row) {
          row.unit = unit;
          row.price_per_unit = pricePerUnit;
          row.date = date;
        }
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db, accounts, investmentPurchases };
}

const CASH_ACCOUNT: AccountRow = { id: "cash-1", account_type: "cash" };
const INVESTMENT_ACCOUNT: AccountRow = { id: "inv-1", account_type: "investment" };
const DEBT_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt" };

describe("applyInvestmentTransaction", () => {
  it("membuat baris investment_purchases untuk transfer cash -> investment, status default pending", async () => {
    const { db, investmentPurchases } = createFakeDb({ accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT] });

    const result = await applyInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "inv-1",
      date: "2026-01-01",
      unit: 66.67,
      pricePerUnit: 1500,
    });

    expect(investmentPurchases).toHaveLength(1);
    expect(investmentPurchases[0]).toMatchObject({
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: 66.67,
      price_per_unit: 1500,
      date: "2026-01-01",
      status: "pending",
    });
    expect(result.investmentPurchaseIds).toHaveLength(1);
  });

  it("membuat baris investment_purchases dengan status settled kalau caller sudah tahu nilainya pasti", async () => {
    const { db, investmentPurchases } = createFakeDb({ accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT] });

    await applyInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "inv-1",
      date: "2026-01-01",
      unit: 66.67,
      pricePerUnit: 1500,
      status: "settled",
    });

    expect(investmentPurchases[0]).toMatchObject({ status: "settled" });
  });

  it("tidak melakukan apa pun untuk transfer cash -> cash", async () => {
    const otherCash: AccountRow = { id: "cash-2", account_type: "cash" };
    const { db, investmentPurchases } = createFakeDb({ accounts: [CASH_ACCOUNT, otherCash] });

    const result = await applyInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "cash-2",
      date: "2026-01-01",
      unit: null,
      pricePerUnit: null,
    });

    expect(investmentPurchases).toHaveLength(0);
    expect(result).toEqual({ investmentPurchaseIds: [], deletedInvestmentPurchaseIds: [] });
  });

  it("tidak melakukan apa pun untuk transaksi bukan transfer", async () => {
    const { db, investmentPurchases } = createFakeDb({ accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT] });

    const result = await applyInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "expense",
      accountId: "cash-1",
      transferAccountId: null,
      date: "2026-01-01",
      unit: null,
      pricePerUnit: null,
    });

    expect(investmentPurchases).toHaveLength(0);
    expect(result).toEqual({ investmentPurchaseIds: [], deletedInvestmentPurchaseIds: [] });
  });

  it("membuat baris investment_purchases dengan unit/harga NULL kalau belum diisi (order masih pending)", async () => {
    const { db, investmentPurchases } = createFakeDb({ accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT] });

    const result = await applyInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "inv-1",
      date: "2026-01-01",
      unit: null,
      pricePerUnit: null,
    });

    expect(investmentPurchases).toHaveLength(1);
    expect(investmentPurchases[0]).toMatchObject({
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: null,
      price_per_unit: null,
      date: "2026-01-01",
    });
    expect(result.investmentPurchaseIds).toHaveLength(1);
  });

  it("tidak melakukan apa pun untuk kombinasi investment -> cash (penjualan, ditangani applySellInvestmentTransaction)", async () => {
    const { db, investmentPurchases } = createFakeDb({ accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT] });

    const result = await applyInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "inv-1",
      transferAccountId: "cash-1",
      date: "2026-01-01",
      unit: 10,
      pricePerUnit: 1500,
    });

    expect(investmentPurchases).toHaveLength(0);
    expect(result).toEqual({ investmentPurchaseIds: [], deletedInvestmentPurchaseIds: [] });
  });

  it("melempar UnsupportedAccountPairError untuk kombinasi debt -> investment", async () => {
    const { db } = createFakeDb({ accounts: [DEBT_ACCOUNT, INVESTMENT_ACCOUNT] });

    await expect(
      applyInvestmentTransaction({
        db: db as never,
        transactionId: "tx-1",
        type: "transfer",
        accountId: "debt-1",
        transferAccountId: "inv-1",
        date: "2026-01-01",
        unit: 10,
        pricePerUnit: 1500,
      })
    ).rejects.toThrow(/belum didukung/);
  });
});

describe("applyInvestmentTransactionEdit", () => {
  it("membuat baris baru kalau transaksi belum pernah punya investment_purchases", async () => {
    const { db, investmentPurchases } = createFakeDb({ accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT] });

    const result = await applyInvestmentTransactionEdit({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "inv-1",
      date: "2026-01-01",
      unit: 10,
      pricePerUnit: 1500,
    });

    expect(investmentPurchases).toHaveLength(1);
    expect(result.deletedInvestmentPurchaseIds).toHaveLength(0);
  });

  it("recreate (hapus lama, buat baru) kalau transaksi sudah punya investment_purchases", async () => {
    const existing: InvestmentPurchaseRow = {
      id: "ip-old",
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: 10,
      price_per_unit: 1000,
      date: "2026-01-01",
      status: "pending",
    };
    const { db, investmentPurchases } = createFakeDb({
      accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT],
      investmentPurchases: [existing],
    });

    const result = await applyInvestmentTransactionEdit({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "inv-1",
      date: "2026-01-02",
      unit: 20,
      pricePerUnit: 1200,
    });

    expect(investmentPurchases).toHaveLength(1);
    expect(investmentPurchases[0]).toMatchObject({ unit: 20, price_per_unit: 1200, date: "2026-01-02" });
    expect(result.deletedInvestmentPurchaseIds).toEqual(["ip-old"]);
    expect(result.investmentPurchaseIds).toHaveLength(1);
  });

  it("UPDATE in-place (bukan delete+recreate) kalau type bukan transfer -- transaksi direct yang diedit tetap income/expense", async () => {
    const existing: InvestmentPurchaseRow = {
      id: "ip-direct",
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: 100,
      price_per_unit: 2000,
      date: "2026-01-01",
      status: "settled",
    };
    const { db, investmentPurchases } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT],
      investmentPurchases: [existing],
    });

    const result = await applyInvestmentTransactionEdit({
      db: db as never,
      transactionId: "tx-1",
      type: "income",
      accountId: "inv-1",
      transferAccountId: null,
      date: "2026-01-02",
      unit: 100,
      pricePerUnit: 2200,
    });

    expect(investmentPurchases).toHaveLength(1);
    expect(investmentPurchases[0]).toMatchObject({
      id: "ip-direct",
      unit: 100,
      price_per_unit: 2200,
      date: "2026-01-02",
    });
    expect(result.investmentPurchaseIds).toEqual(["ip-direct"]);
    expect(result.deletedInvestmentPurchaseIds).toHaveLength(0);
  });

  it("fallback ke unit/price_per_unit LAMA kalau input baru null (race condition form, bukan user sengaja mengosongkan)", async () => {
    const existing: InvestmentPurchaseRow = {
      id: "ip-direct",
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: 1,
      price_per_unit: 10000,
      date: "2026-01-01",
      status: "settled",
    };
    const { db, investmentPurchases } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT],
      investmentPurchases: [existing],
    });

    const result = await applyInvestmentTransactionEdit({
      db: db as never,
      transactionId: "tx-1",
      type: "income",
      accountId: "inv-1",
      transferAccountId: null,
      date: "2026-01-02",
      unit: null,
      pricePerUnit: null,
    });

    expect(investmentPurchases[0]).toMatchObject({
      id: "ip-direct",
      unit: 1,
      price_per_unit: 10000,
      date: "2026-01-02",
    });
    expect(result.investmentPurchaseIds).toEqual(["ip-direct"]);
  });

  it("melempar InvestmentPurchaseEditBlockedError kalau mengurangi unit purchase settled membuat sisa unit akun negatif", async () => {
    const existing: InvestmentPurchaseRow = {
      id: "ip-1",
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: 10,
      price_per_unit: 1000,
      date: "2026-01-01",
      status: "settled",
    };
    const { db, investmentPurchases } = createFakeDb({
      accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT],
      investmentPurchases: [existing],
      investmentSales: [{ account_id: "inv-1", unit: 8, status: "settled" }],
    });

    await expect(
      applyInvestmentTransactionEdit({
        db: db as never,
        transactionId: "tx-1",
        type: "transfer",
        accountId: "cash-1",
        transferAccountId: "inv-1",
        date: "2026-01-02",
        unit: 2,
        pricePerUnit: 1000,
        status: "settled",
      })
    ).rejects.toThrow(InvestmentPurchaseEditBlockedError);

    expect(investmentPurchases).toHaveLength(1);
    expect(investmentPurchases[0]).toMatchObject({ id: "ip-1", unit: 10 });
  });

  it("mengizinkan edit unit purchase settled kalau sisa unit akun TETAP non-negatif", async () => {
    const existing: InvestmentPurchaseRow = {
      id: "ip-1",
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: 10,
      price_per_unit: 1000,
      date: "2026-01-01",
      status: "settled",
    };
    const { db, investmentPurchases } = createFakeDb({
      accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT],
      investmentPurchases: [existing],
      investmentSales: [{ account_id: "inv-1", unit: 8, status: "settled" }],
    });

    const result = await applyInvestmentTransactionEdit({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "inv-1",
      date: "2026-01-02",
      unit: 9,
      pricePerUnit: 1000,
      status: "settled",
    });

    expect(result.deletedInvestmentPurchaseIds).toEqual(["ip-1"]);
    expect(investmentPurchases).toHaveLength(1);
    expect(investmentPurchases[0]).toMatchObject({ unit: 9 });
  });
});

describe("detachInvestmentPurchaseForDeletedTransaction", () => {
  it("role 'none' kalau transaksi tidak punya investment_purchases", async () => {
    const { db } = createFakeDb({ accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT] });

    const result = await detachInvestmentPurchaseForDeletedTransaction(db as never, "tx-1");

    expect(result).toEqual({ role: "none" });
  });

  it("hard-delete baris investment_purchases dan melaporkan id-nya", async () => {
    const existing: InvestmentPurchaseRow = {
      id: "ip-1",
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: 10,
      price_per_unit: 1000,
      date: "2026-01-01",
      status: "pending",
    };
    const { db, investmentPurchases } = createFakeDb({
      accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT],
      investmentPurchases: [existing],
    });

    const result = await detachInvestmentPurchaseForDeletedTransaction(db as never, "tx-1");

    expect(result).toEqual({ role: "purchase", investmentPurchaseId: "ip-1" });
    expect(investmentPurchases).toHaveLength(0);
  });
});
