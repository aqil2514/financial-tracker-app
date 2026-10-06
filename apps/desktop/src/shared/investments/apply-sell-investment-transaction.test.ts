import { describe, expect, it } from "vitest";

import {
  applySellInvestmentTransaction,
  applySellInvestmentTransactionEdit,
  deletePendingInvestmentSale,
  detachInvestmentSaleForDeletedTransaction,
  InsufficientInvestmentUnitsError,
  settleInvestmentSale,
} from "./apply-sell-investment-transaction";

/**
 * Fake DB in-memory meniru HANYA pola SQL yang dipakai
 * apply-sell-investment-transaction.ts — pola sama fake db di
 * apply-investment-transaction.test.ts, diperluas untuk juga menangani
 * query ke `investment_sales` dan `transactions` (leg penyesuaian P/L).
 * `adjustment_transaction_id` adalah FK EKSPLISIT (migrasi 0039) — fake db
 * ini TIDAK perlu simulasi lookup note/transfer_account_id lagi karena
 * kode sekarang baca/tulis kolom itu langsung.
 *
 * **Keputusan 2026-10-07**: `average_cost_per_unit`/`realized_pl` di
 * `investment_sales` sekarang NULLABLE (migrasi 0041) — NULL selama
 * `status='pending'` (dana belum cair, average cost belum final), baru
 * diisi saat `status='settled'`. Fungsi `apply*` TIDAK LAGI insert leg
 * transfer utama sendiri (pola PERSIS applyInvestmentTransaction/
 * applyDebtTransaction) — caller yang insert, `transactionId` dioper
 * sebagai parameter (`null` untuk pending).
 */
type AccountRow = { id: string; account_type: "cash" | "debt" | "investment" };
type InvestmentPurchaseRow = {
  id: string;
  account_id: string;
  unit: number | null;
  price_per_unit: number | null;
  status: "pending" | "settled";
};
type InvestmentSaleRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  adjustment_transaction_id: string | null;
  unit: number;
  price_per_unit: number;
  average_cost_per_unit: number | null;
  realized_pl: number | null;
  date: string;
  status: "pending" | "settled";
};
type TransactionRow = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  account_id: string;
  date: string;
};

function createFakeDb(
  seed: {
    accounts?: AccountRow[];
    investmentPurchases?: InvestmentPurchaseRow[];
    investmentSales?: InvestmentSaleRow[];
    transactions?: TransactionRow[];
  } = {}
) {
  const accounts = seed.accounts ?? [];
  const investmentPurchases: InvestmentPurchaseRow[] = seed.investmentPurchases ?? [];
  const investmentSales: InvestmentSaleRow[] = seed.investmentSales ?? [];
  const transactions: TransactionRow[] = seed.transactions ?? [];

  const db = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      if (sql.includes("FROM accounts WHERE id")) {
        const [id] = params as [string];
        const account = accounts.find((a) => a.id === id);
        return (account ? [{ account_type: account.account_type }] : []) as T;
      }
      if (sql.includes("SUM(unit * price_per_unit)") && sql.includes("investment_purchases")) {
        const [accountId] = params as [string];
        const rows = investmentPurchases.filter(
          (p) => p.account_id === accountId && p.status === "settled"
        );
        const totalUnit = rows.reduce((sum, r) => sum + (r.unit ?? 0), 0);
        const totalCost = rows.reduce((sum, r) => sum + (r.unit ?? 0) * (r.price_per_unit ?? 0), 0);
        return [{ total_cost: totalCost, total_unit: totalUnit }] as T;
      }
      if (sql.includes("SUM(unit)") && sql.includes("FROM investment_purchases") && sql.includes("settled")) {
        const [accountId] = params as [string];
        const rows = investmentPurchases.filter(
          (p) => p.account_id === accountId && p.status === "settled"
        );
        const totalUnit = rows.reduce((sum, r) => sum + (r.unit ?? 0), 0);
        return [{ total_unit: totalUnit }] as T;
      }
      if (sql.includes("SUM(unit)") && sql.includes("FROM investment_sales")) {
        const [accountId] = params as [string];
        const rows = investmentSales.filter(
          (s) => s.account_id === accountId && (s.status === "pending" || s.status === "settled")
        );
        const totalUnit = rows.reduce((sum, r) => sum + r.unit, 0);
        return [{ total_unit: totalUnit }] as T;
      }
      if (sql.startsWith("SELECT id FROM investment_sales WHERE transaction_id")) {
        const [transactionId] = params as [string];
        const match = investmentSales.find((s) => s.transaction_id === transactionId);
        return (match ? [{ id: match.id }] : []) as T;
      }
      if (sql.startsWith("SELECT adjustment_transaction_id FROM investment_sales")) {
        const [id] = params as [string];
        const match = investmentSales.find((s) => s.id === id);
        return (match ? [{ adjustment_transaction_id: match.adjustment_transaction_id }] : []) as T;
      }
      if (sql.startsWith("SELECT account_id, unit, price_per_unit, date, status, transaction_id FROM investment_sales")) {
        const [id] = params as [string];
        const match = investmentSales.find((s) => s.id === id);
        return (match
          ? [
              {
                account_id: match.account_id,
                unit: match.unit,
                price_per_unit: match.price_per_unit,
                date: match.date,
                status: match.status,
                transaction_id: match.transaction_id,
              },
            ]
          : []) as T;
      }
      if (sql.startsWith("SELECT status, transaction_id FROM investment_sales")) {
        const [id] = params as [string];
        const match = investmentSales.find((s) => s.id === id);
        return (match ? [{ status: match.status, transaction_id: match.transaction_id }] : []) as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("INSERT INTO investment_sales")) {
        // `status` adalah literal SQL ('pending'/'settled'), BUKAN
        // parameter $n (lihat apply-sell-investment-transaction.ts) --
        // dibaca dari akhir string VALUES, bukan destructured dari params.
        const status = sql.includes("'settled'") ? "settled" : "pending";
        // Jalur pending: 5 params (id, accountId, unit, pricePerUnit, date)
        // -- transaction_id/adjustment_transaction_id/average_cost/realized_pl
        // adalah literal NULL di SQL. Jalur settled: 9 params.
        if (status === "pending") {
          const [id, accountId, unit, pricePerUnit, date] = params as [string, string, number, number, string];
          investmentSales.push({
            id,
            account_id: accountId,
            transaction_id: null,
            adjustment_transaction_id: null,
            unit,
            price_per_unit: pricePerUnit,
            average_cost_per_unit: null,
            realized_pl: null,
            date,
            status: "pending",
          });
          return {};
        }
        const [id, accountId, transactionId, adjustmentTransactionId, unit, pricePerUnit, averageCost, realizedPl, date] =
          params as [string, string, string, string | null, number, number, number, number, string];
        investmentSales.push({
          id,
          account_id: accountId,
          transaction_id: transactionId,
          adjustment_transaction_id: adjustmentTransactionId,
          unit,
          price_per_unit: pricePerUnit,
          average_cost_per_unit: averageCost,
          realized_pl: realizedPl,
          date,
          status: "settled",
        });
        return {};
      }
      if (sql.startsWith("UPDATE investment_sales")) {
        const [transactionId, adjustmentTransactionId, averageCost, realizedPl, id] = params as [
          string,
          string | null,
          number,
          number,
          string,
        ];
        const sale = investmentSales.find((s) => s.id === id);
        if (sale != null) {
          sale.transaction_id = transactionId;
          sale.adjustment_transaction_id = adjustmentTransactionId;
          sale.average_cost_per_unit = averageCost;
          sale.realized_pl = realizedPl;
          sale.status = "settled";
        }
        return {};
      }
      if (sql.startsWith("DELETE FROM investment_sales")) {
        const [id] = params as [string];
        const index = investmentSales.findIndex((s) => s.id === id);
        if (index >= 0) investmentSales.splice(index, 1);
        return {};
      }
      if (sql.startsWith("INSERT INTO transactions")) {
        if (sql.includes("'transfer'")) {
          // Leg transfer utama dibuat LANGSUNG oleh settleInvestmentSale
          // (tidak ada "caller form" di jalur settle) -- type literal
          // 'transfer', params: [id, amount, accountId, transferAccountId,
          // note, date] (category_id/description NULL literal, SQL beda
          // dari leg penyesuaian P/L di bawah).
          const [id, amount, accountId] = params as [string, number, string, string, string, string];
          transactions.push({ id, type: "transfer", amount, account_id: accountId, date: params[5] as string });
          return {};
        }
        // Leg penyesuaian P/L (createAdjustmentTransaction) -- params:
        // [id, type, amount, accountId, note, date] (category_id/
        // transfer_account_id/description di-NULL-kan literal di SQL,
        // tidak ikut jadi parameter).
        const [id, type, amount, accountId, , date] = params as [
          string,
          "income" | "expense" | "transfer",
          number,
          string,
          string,
          string,
        ];
        transactions.push({ id, type, amount, account_id: accountId, date });
        return {};
      }
      if (sql.startsWith("DELETE FROM transactions")) {
        const [id] = params as [string];
        const index = transactions.findIndex((t) => t.id === id);
        if (index >= 0) transactions.splice(index, 1);
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db, accounts, investmentPurchases, investmentSales, transactions };
}

const CASH_ACCOUNT: AccountRow = { id: "cash-1", account_type: "cash" };
const INVESTMENT_ACCOUNT: AccountRow = { id: "inv-1", account_type: "investment" };
const DEBT_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt" };

const SETTLED_PURCHASE: InvestmentPurchaseRow = {
  id: "p-1",
  account_id: "inv-1",
  unit: 100,
  price_per_unit: 1000,
  status: "settled",
};

describe("applySellInvestmentTransaction", () => {
  it("status pending: hanya membuat baris investment_sales, TIDAK ada transaksi apa pun", async () => {
    const { db, investmentSales, transactions } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
    });

    const result = await applySellInvestmentTransaction({
      db: db as never,
      transactionId: null,
      accountId: "inv-1",
      transferAccountId: "cash-1",
      date: "2026-02-01",
      unit: 30,
      pricePerUnit: 1200,
    });

    expect(investmentSales).toHaveLength(1);
    expect(investmentSales[0]).toMatchObject({
      account_id: "inv-1",
      transaction_id: null,
      adjustment_transaction_id: null,
      unit: 30,
      price_per_unit: 1200,
      average_cost_per_unit: null,
      realized_pl: null,
      status: "pending",
    });
    expect(result.investmentSaleIds).toHaveLength(1);
    expect(result.adjustmentTransactionId).toBeNull();

    // TIDAK ada baris transactions sama sekali -- dana belum cair ke kas
    // selama order masih pending (keputusan 2026-10-07).
    expect(transactions).toHaveLength(0);
  });

  it("status settled: menghitung realized P/L positif (gain) dan membuat leg penyesuaian", async () => {
    const { db, investmentSales, transactions } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
      transactions: [{ id: "tx-1", type: "transfer", amount: 30000, account_id: "inv-1", date: "2026-02-01" }],
    });

    const result = await applySellInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      accountId: "inv-1",
      transferAccountId: "cash-1",
      date: "2026-02-01",
      unit: 30,
      pricePerUnit: 1200,
      status: "settled",
    });

    expect(investmentSales).toHaveLength(1);
    expect(investmentSales[0]).toMatchObject({
      account_id: "inv-1",
      transaction_id: "tx-1",
      unit: 30,
      price_per_unit: 1200,
      average_cost_per_unit: 1000,
      realized_pl: 6000, // (1200-1000)*30
      status: "settled",
    });

    // Leg kedua (penyesuaian P/L gain) dibuat sebagai income di akun kas,
    // di samping leg transfer utama yang sudah di-seed (SUDAH diinsert
    // caller SEBELUM memanggil fungsi ini, pola PERSIS applyDebtTransaction).
    expect(transactions).toHaveLength(2);
    const adjustment = transactions.find((t) => t.id !== "tx-1");
    expect(adjustment).toMatchObject({ type: "income", amount: 6000, account_id: "cash-1" });
    expect(result.adjustmentTransactionId).toBe(adjustment?.id);
    expect(investmentSales[0].adjustment_transaction_id).toBe(adjustment?.id);
  });

  it("status settled: realized P/L negatif (loss) sebagai transaksi expense di akun kas", async () => {
    const { db, investmentSales, transactions } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
      transactions: [{ id: "tx-1", type: "transfer", amount: 30000, account_id: "inv-1", date: "2026-02-01" }],
    });

    await applySellInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      accountId: "inv-1",
      transferAccountId: "cash-1",
      date: "2026-02-01",
      unit: 30,
      pricePerUnit: 800,
      status: "settled",
    });

    expect(investmentSales[0]).toMatchObject({ realized_pl: -6000 }); // (800-1000)*30
    const adjustment = transactions.find((t) => t.id !== "tx-1");
    expect(adjustment).toMatchObject({ type: "expense", amount: 6000, account_id: "cash-1" });
  });

  it("status settled: tidak membuat transaksi penyesuaian kalau realized P/L == 0", async () => {
    const { db, transactions, investmentSales } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
      transactions: [{ id: "tx-1", type: "transfer", amount: 10000, account_id: "inv-1", date: "2026-02-01" }],
    });

    const result = await applySellInvestmentTransaction({
      db: db as never,
      transactionId: "tx-1",
      accountId: "inv-1",
      transferAccountId: "cash-1",
      date: "2026-02-01",
      unit: 10,
      pricePerUnit: 1000,
      status: "settled",
    });

    expect(transactions).toHaveLength(1); // cuma leg transfer utama yg di-seed
    expect(result.adjustmentTransactionId).toBeNull();
    expect(investmentSales[0].adjustment_transaction_id).toBeNull();
  });

  it("status settled tanpa transactionId: melempar error (leg transfer utama wajib sudah di-insert caller)", async () => {
    const { db } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
    });

    await expect(
      applySellInvestmentTransaction({
        db: db as never,
        transactionId: null,
        accountId: "inv-1",
        transferAccountId: "cash-1",
        date: "2026-02-01",
        unit: 10,
        pricePerUnit: 1100,
        status: "settled",
      })
    ).rejects.toThrow(/transactionId wajib diisi/);
  });

  it("menolak oversell (unit jual > sisa unit settled)", async () => {
    const { db } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE], // 100 unit settled
    });

    await expect(
      applySellInvestmentTransaction({
        db: db as never,
        transactionId: null,
        accountId: "inv-1",
        transferAccountId: "cash-1",
        date: "2026-02-01",
        unit: 150,
        pricePerUnit: 1200,
      })
    ).rejects.toThrow(InsufficientInvestmentUnitsError);
  });

  it("unit dari pembelian PENDING tidak ikut dihitung sebagai sisa yang bisa dijual", async () => {
    const pendingPurchase: InvestmentPurchaseRow = {
      id: "p-2",
      account_id: "inv-1",
      unit: 1000,
      price_per_unit: 500,
      status: "pending",
    };
    const { db } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE, pendingPurchase], // hanya 100 settled yg terhitung
    });

    // Minta jual 150 -- kalau pending (1000) ikut terhitung akan lolos,
    // tapi seharusnya ditolak karena cuma 100 unit settled yang valid.
    await expect(
      applySellInvestmentTransaction({
        db: db as never,
        transactionId: null,
        accountId: "inv-1",
        transferAccountId: "cash-1",
        date: "2026-02-01",
        unit: 150,
        pricePerUnit: 1200,
      })
    ).rejects.toThrow(InsufficientInvestmentUnitsError);
  });

  it("penjualan sebelumnya (pending maupun settled) ikut mengurangi sisa unit yang bisa dijual lagi", async () => {
    const existingSale: InvestmentSaleRow = {
      id: "s-1",
      account_id: "inv-1",
      transaction_id: null,
      adjustment_transaction_id: null,
      unit: 80,
      price_per_unit: 1100,
      average_cost_per_unit: null,
      realized_pl: null,
      date: "2026-01-15",
      status: "pending",
    };
    const { db } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE], // 100 settled
      investmentSales: [existingSale], // 80 sudah terjual -> sisa 20
    });

    await expect(
      applySellInvestmentTransaction({
        db: db as never,
        transactionId: null,
        accountId: "inv-1",
        transferAccountId: "cash-1",
        date: "2026-02-01",
        unit: 21,
        pricePerUnit: 1200,
      })
    ).rejects.toThrow(InsufficientInvestmentUnitsError);
  });

  it("tidak melakukan apa pun kalau transferAccountId null", async () => {
    const { db, investmentSales } = createFakeDb({ accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT] });

    const result = await applySellInvestmentTransaction({
      db: db as never,
      transactionId: null,
      accountId: "inv-1",
      transferAccountId: null,
      date: "2026-01-01",
      unit: 10,
      pricePerUnit: 1000,
    });

    expect(investmentSales).toHaveLength(0);
    expect(result).toEqual({
      investmentSaleIds: [],
      deletedInvestmentSaleIds: [],
      adjustmentTransactionId: null,
    });
  });

  it("tidak melakukan apa pun untuk arah cash -> investment (bukan penjualan)", async () => {
    const { db, investmentSales } = createFakeDb({
      accounts: [CASH_ACCOUNT, INVESTMENT_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
    });

    const result = await applySellInvestmentTransaction({
      db: db as never,
      transactionId: null,
      accountId: "cash-1",
      transferAccountId: "inv-1",
      date: "2026-01-01",
      unit: 10,
      pricePerUnit: 1000,
    });

    expect(investmentSales).toHaveLength(0);
    expect(result.investmentSaleIds).toHaveLength(0);
  });

  it("melempar UnsupportedAccountPairError untuk kombinasi debt -> cash", async () => {
    const { db } = createFakeDb({ accounts: [DEBT_ACCOUNT, CASH_ACCOUNT] });

    // debt-cash valid di classifyAccountPair tapi bukan investment-cash --
    // fungsi ini no-op, BUKAN melempar (lihat pairKind !== "investment-cash").
    const result = await applySellInvestmentTransaction({
      db: db as never,
      transactionId: null,
      accountId: "debt-1",
      transferAccountId: "cash-1",
      date: "2026-01-01",
      unit: 10,
      pricePerUnit: 1000,
    });

    expect(result.investmentSaleIds).toHaveLength(0);
  });
});

describe("applySellInvestmentTransactionEdit", () => {
  it("membuat baris baru (settled) kalau transaksi belum pernah punya investment_sales", async () => {
    const { db, investmentSales } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
      transactions: [{ id: "tx-1", type: "transfer", amount: 10000, account_id: "inv-1", date: "2026-02-01" }],
    });

    const result = await applySellInvestmentTransactionEdit("tx-1", {
      db: db as never,
      transactionId: "tx-1",
      accountId: "inv-1",
      transferAccountId: "cash-1",
      date: "2026-02-01",
      unit: 10,
      pricePerUnit: 1200,
    });

    expect(investmentSales).toHaveLength(1);
    expect(investmentSales[0]).toMatchObject({ status: "settled", transaction_id: "tx-1" });
    expect(result.deletedInvestmentSaleIds).toHaveLength(0);
  });

  it("recreate (hapus lama + transaksi penyesuaian lama, buat baru) kalau transaksi sudah punya investment_sales", async () => {
    const existingSale: InvestmentSaleRow = {
      id: "s-old",
      account_id: "inv-1",
      transaction_id: "tx-1",
      adjustment_transaction_id: "adj-old",
      unit: 10,
      price_per_unit: 1100,
      average_cost_per_unit: 1000,
      realized_pl: 1000,
      date: "2026-02-01",
      status: "settled",
    };
    const mainTransferTx: TransactionRow = {
      id: "tx-1",
      type: "transfer",
      amount: 20000,
      account_id: "inv-1",
      date: "2026-02-01",
    };
    const existingAdjustment: TransactionRow = {
      id: "adj-old",
      type: "income",
      amount: 1000,
      account_id: "cash-1",
      date: "2026-02-01",
    };
    const { db, investmentSales, transactions } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
      investmentSales: [existingSale],
      transactions: [mainTransferTx, existingAdjustment],
    });

    const result = await applySellInvestmentTransactionEdit("tx-1", {
      db: db as never,
      transactionId: "tx-1",
      accountId: "inv-1",
      transferAccountId: "cash-1",
      date: "2026-02-01",
      unit: 20,
      pricePerUnit: 1300,
    });

    expect(investmentSales).toHaveLength(1);
    expect(investmentSales[0]).toMatchObject({ unit: 20, price_per_unit: 1300, status: "settled" });
    expect(result.deletedInvestmentSaleIds).toEqual(["s-old"]);
    // Transaksi penyesuaian lama ("adj-old") terhapus, yang tersisa cuma
    // transaksi utama + transaksi penyesuaian BARU hasil recreate.
    expect(transactions.find((t) => t.id === "adj-old")).toBeUndefined();
    expect(transactions).toHaveLength(2);
  });
});

describe("settleInvestmentSale", () => {
  it("settle baris pending: insert leg transfer utama + leg penyesuaian, update status jadi settled", async () => {
    const pendingSale: InvestmentSaleRow = {
      id: "s-1",
      account_id: "inv-1",
      transaction_id: null,
      adjustment_transaction_id: null,
      unit: 30,
      price_per_unit: 1200,
      average_cost_per_unit: null,
      realized_pl: null,
      date: "2026-02-01",
      status: "pending",
    };
    const { db, investmentSales, transactions } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentPurchases: [SETTLED_PURCHASE],
      investmentSales: [pendingSale],
    });

    const result = await settleInvestmentSale(db as never, "s-1", "cash-1");

    expect(investmentSales[0]).toMatchObject({
      status: "settled",
      transaction_id: result.transactionId,
      average_cost_per_unit: 1000,
      realized_pl: 6000, // (1200-1000)*30
    });
    // Leg transfer utama (average_cost * unit) + leg penyesuaian P/L.
    expect(transactions).toHaveLength(2);
    const mainLeg = transactions.find((t) => t.id === result.transactionId);
    expect(mainLeg).toMatchObject({ type: "transfer", amount: 30000, account_id: "inv-1" });
    expect(result.adjustmentTransactionId).not.toBeNull();
  });

  it("menolak settle baris yang sudah settled", async () => {
    const settledSale: InvestmentSaleRow = {
      id: "s-1",
      account_id: "inv-1",
      transaction_id: "tx-1",
      adjustment_transaction_id: null,
      unit: 10,
      price_per_unit: 1000,
      average_cost_per_unit: 1000,
      realized_pl: 0,
      date: "2026-02-01",
      status: "settled",
    };
    const { db } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentSales: [settledSale],
    });

    await expect(settleInvestmentSale(db as never, "s-1", "cash-1")).rejects.toThrow(/sudah settled/);
  });

  it("melempar error kalau baris tidak ditemukan", async () => {
    const { db } = createFakeDb({ accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT] });

    await expect(settleInvestmentSale(db as never, "nonexistent", "cash-1")).rejects.toThrow(/tidak ditemukan/);
  });
});

describe("deletePendingInvestmentSale", () => {
  it("menghapus baris pending", async () => {
    const pendingSale: InvestmentSaleRow = {
      id: "s-1",
      account_id: "inv-1",
      transaction_id: null,
      adjustment_transaction_id: null,
      unit: 10,
      price_per_unit: 1000,
      average_cost_per_unit: null,
      realized_pl: null,
      date: "2026-02-01",
      status: "pending",
    };
    const { db, investmentSales } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentSales: [pendingSale],
    });

    await deletePendingInvestmentSale(db as never, "s-1");

    expect(investmentSales).toHaveLength(0);
  });

  it("menolak hapus baris yang sudah settled", async () => {
    const settledSale: InvestmentSaleRow = {
      id: "s-1",
      account_id: "inv-1",
      transaction_id: "tx-1",
      adjustment_transaction_id: null,
      unit: 10,
      price_per_unit: 1000,
      average_cost_per_unit: 1000,
      realized_pl: 0,
      date: "2026-02-01",
      status: "settled",
    };
    const { db, investmentSales } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentSales: [settledSale],
    });

    await expect(deletePendingInvestmentSale(db as never, "s-1")).rejects.toThrow(/sudah settled/);
    expect(investmentSales).toHaveLength(1);
  });
});

describe("detachInvestmentSaleForDeletedTransaction", () => {
  it("role 'none' kalau transaksi tidak punya investment_sales", async () => {
    const { db } = createFakeDb({ accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT] });

    const result = await detachInvestmentSaleForDeletedTransaction(db as never, "tx-1");

    expect(result).toEqual({ role: "none" });
  });

  it("hard-delete baris investment_sales + transaksi penyesuaian P/L miliknya (via FK)", async () => {
    const existingSale: InvestmentSaleRow = {
      id: "s-1",
      account_id: "inv-1",
      transaction_id: "tx-1",
      adjustment_transaction_id: "adj-1",
      unit: 10,
      price_per_unit: 1100,
      average_cost_per_unit: 1000,
      realized_pl: 1000,
      date: "2026-02-01",
      status: "settled",
    };
    const mainTransferTx: TransactionRow = {
      id: "tx-1",
      type: "transfer",
      amount: 10000,
      account_id: "inv-1",
      date: "2026-02-01",
    };
    const existingAdjustment: TransactionRow = {
      id: "adj-1",
      type: "income",
      amount: 1000,
      account_id: "cash-1",
      date: "2026-02-01",
    };
    const { db, investmentSales, transactions } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentSales: [existingSale],
      transactions: [mainTransferTx, existingAdjustment],
    });

    const result = await detachInvestmentSaleForDeletedTransaction(db as never, "tx-1");

    expect(result).toEqual({ role: "sale", investmentSaleId: "s-1", adjustmentTransactionId: "adj-1" });
    expect(investmentSales).toHaveLength(0);
    // Transaksi penyesuaian terhapus; transaksi UTAMA (leg transfer)
    // TIDAK disentuh fungsi ini -- itu urusan caller (use-delete-transaction.ts)
    // yang hard-delete-nya SETELAH detach ini selesai.
    expect(transactions).toHaveLength(1);
    expect(transactions[0].id).toBe("tx-1");
  });

  it("role 'sale' dengan adjustmentTransactionId null kalau realized P/L == 0", async () => {
    const existingSale: InvestmentSaleRow = {
      id: "s-1",
      account_id: "inv-1",
      transaction_id: "tx-1",
      adjustment_transaction_id: null,
      unit: 10,
      price_per_unit: 1000,
      average_cost_per_unit: 1000,
      realized_pl: 0,
      date: "2026-02-01",
      status: "settled",
    };
    const { db, investmentSales } = createFakeDb({
      accounts: [INVESTMENT_ACCOUNT, CASH_ACCOUNT],
      investmentSales: [existingSale],
    });

    const result = await detachInvestmentSaleForDeletedTransaction(db as never, "tx-1");

    expect(result).toEqual({ role: "sale", investmentSaleId: "s-1", adjustmentTransactionId: null });
    expect(investmentSales).toHaveLength(0);
  });
});
