import { describe, expect, it } from "vitest";

import {
  applyInvestmentTransaction,
  applyInvestmentTransactionEdit,
  detachInvestmentPurchaseForDeletedTransaction,
} from "./apply-investment-transaction";

/**
 * Fake DB in-memory meniru HANYA pola SQL yang dipakai
 * apply-investment-transaction.ts — pola sama fake db di
 * apply-debt-transaction.test.ts (lihat komentar di sana untuk alasan
 * memilih fake ini alih-alih SQLite asli).
 */
type AccountRow = { id: string; account_type: "cash" | "debt" | "investment" };
type InvestmentPurchaseRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  unit: number;
  price_per_unit: number;
  date: string;
};

function createFakeDb(
  seed: { accounts?: AccountRow[]; investmentPurchases?: InvestmentPurchaseRow[] } = {}
) {
  const accounts = seed.accounts ?? [];
  const investmentPurchases: InvestmentPurchaseRow[] = seed.investmentPurchases ?? [];

  const db = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      if (sql.includes("FROM accounts WHERE id")) {
        const [id] = params as [string];
        const account = accounts.find((a) => a.id === id);
        return (account ? [{ account_type: account.account_type }] : []) as T;
      }
      if (sql.startsWith("SELECT id FROM investment_purchases WHERE transaction_id")) {
        const [transactionId] = params as [string];
        const match = investmentPurchases.find((p) => p.transaction_id === transactionId);
        return (match ? [{ id: match.id }] : []) as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("INSERT INTO investment_purchases")) {
        const [id, accountId, transactionId, unit, pricePerUnit, date] = params as [
          string,
          string,
          string,
          number,
          number,
          string,
        ];
        investmentPurchases.push({ id, account_id: accountId, transaction_id: transactionId, unit, price_per_unit: pricePerUnit, date });
        return {};
      }
      if (sql.startsWith("DELETE FROM investment_purchases")) {
        const [id] = params as [string];
        const index = investmentPurchases.findIndex((p) => p.id === id);
        if (index >= 0) investmentPurchases.splice(index, 1);
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
  it("membuat baris investment_purchases untuk transfer cash -> investment", async () => {
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
    });
    expect(result.investmentPurchaseIds).toHaveLength(1);
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

  it("throw kalau unit/harga per unit tidak diisi untuk transfer cash -> investment", async () => {
    const { db } = createFakeDb({ accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT] });

    await expect(
      applyInvestmentTransaction({
        db: db as never,
        transactionId: "tx-1",
        type: "transfer",
        accountId: "cash-1",
        transferAccountId: "inv-1",
        date: "2026-01-01",
        unit: null,
        pricePerUnit: null,
      })
    ).rejects.toThrow(/wajib diisi/);
  });

  it("melempar UnsupportedAccountPairError untuk kombinasi investment -> cash (penarikan, belum didukung)", async () => {
    const { db } = createFakeDb({ accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT] });

    await expect(
      applyInvestmentTransaction({
        db: db as never,
        transactionId: "tx-1",
        type: "transfer",
        accountId: "inv-1",
        transferAccountId: "cash-1",
        date: "2026-01-01",
        unit: 10,
        pricePerUnit: 1500,
      })
    ).rejects.toThrow(/belum didukung/);
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
