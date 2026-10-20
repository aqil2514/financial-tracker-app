import { describe, expect, it } from "vitest";

import { checkBalanceConsistency } from "./check-balance-consistency";

type AccountRow = { id: string; name: string; account_type: "cash" | "debt" | "investment"; deleted_at: string | null };
type TransactionRow = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  account_id: string | null;
  transfer_account_id: string | null;
  note: string;
  date: string;
  deleted_at: string | null;
};
type DebtRow = { id: string; transaction_id: string | null; deleted_at: string | null };
type DebtPaymentRow = { id: string; transaction_id: string | null; deleted_at: string | null };
type DebtAmountAdjustmentRow = { id: string; transaction_id: string | null };
type InvestmentPurchaseRow = { id: string; transaction_id: string | null; deleted_at: string | null };
type InvestmentSaleRow = { id: string; transaction_id: string | null; deleted_at: string | null };

function createFakeDb(seed: {
  accounts: AccountRow[];
  transactions: TransactionRow[];
  debts?: DebtRow[];
  debtPayments?: DebtPaymentRow[];
  debtAmountAdjustments?: DebtAmountAdjustmentRow[];
  investmentPurchases?: InvestmentPurchaseRow[];
  investmentSales?: InvestmentSaleRow[];
}) {
  const { accounts, transactions } = seed;
  const debts = seed.debts ?? [];
  const debtPayments = seed.debtPayments ?? [];
  const debtAmountAdjustments = seed.debtAmountAdjustments ?? [];
  const investmentPurchases = seed.investmentPurchases ?? [];
  const investmentSales = seed.investmentSales ?? [];

  function accountOf(id: string | null) {
    return accounts.find((a) => a.id === id) ?? null;
  }

  function hasDerivedRow(transactionId: string, accountType: "debt" | "investment"): boolean {
    if (accountType === "debt") {
      return (
        debts.some((d) => d.transaction_id === transactionId && d.deleted_at == null) ||
        debtPayments.some((p) => p.transaction_id === transactionId && p.deleted_at == null) ||
        debtAmountAdjustments.some((a) => a.transaction_id === transactionId)
      );
    }
    return (
      investmentPurchases.some((p) => p.transaction_id === transactionId && p.deleted_at == null) ||
      investmentSales.some((s) => s.transaction_id === transactionId && s.deleted_at == null)
    );
  }

  const db = {
    async select<T>(sql: string): Promise<T> {
      const isDebtQuery = sql.includes("'debt' AS account_type");
      const accountType: "debt" | "investment" = isDebtQuery ? "debt" : "investment";

      const results: {
        id: string;
        type: string;
        amount: number;
        account_id: string | null;
        account_name: string | null;
        account_type: string;
        note: string;
        date: string;
      }[] = [];

      for (const t of transactions) {
        if (t.deleted_at != null) continue;

        const account = accountOf(t.account_id);
        const transferAccount = accountOf(t.transfer_account_id);

        if (account && account.account_type === accountType && account.deleted_at == null) {
          if (isDebtQuery && t.type === "transfer" && transferAccount?.account_type === "debt") continue;
          if (!hasDerivedRow(t.id, accountType)) {
            results.push({
              id: t.id,
              type: t.type,
              amount: t.amount,
              account_id: account.id,
              account_name: account.name,
              account_type: accountType,
              note: t.note,
              date: t.date,
            });
            continue;
          }
        }

        if (
          t.type === "transfer" &&
          transferAccount &&
          transferAccount.account_type === accountType &&
          transferAccount.deleted_at == null
        ) {
          if (isDebtQuery && account?.account_type === "debt") continue;
          if (!hasDerivedRow(t.id, accountType)) {
            results.push({
              id: t.id,
              type: t.type,
              amount: t.amount,
              account_id: transferAccount.id,
              account_name: transferAccount.name,
              account_type: accountType,
              note: t.note,
              date: t.date,
            });
          }
        }
      }

      return results as T;
    },
  };

  return { db: db as unknown as Parameters<typeof checkBalanceConsistency>[0] };
}

describe("checkBalanceConsistency", () => {
  it("mendeteksi transaksi transfer cash->debt yang tidak punya baris debts/debt_payments pasangan", async () => {
    const { db } = createFakeDb({
      accounts: [
        { id: "cash1", name: "Dompet", account_type: "cash", deleted_at: null },
        { id: "debt1", name: "Piutang Budi", account_type: "debt", deleted_at: null },
      ],
      transactions: [
        {
          id: "tx1",
          type: "transfer",
          amount: 10000,
          account_id: "cash1",
          transfer_account_id: "debt1",
          note: "Transfer yatim",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "tx1", account_id: "debt1", account_type: "debt" });
  });

  it("TIDAK mendeteksi transaksi transfer cash->debt yang punya baris debts pasangan", async () => {
    const { db } = createFakeDb({
      accounts: [
        { id: "cash1", name: "Dompet", account_type: "cash", deleted_at: null },
        { id: "debt1", name: "Piutang Budi", account_type: "debt", deleted_at: null },
      ],
      transactions: [
        {
          id: "tx1",
          type: "transfer",
          amount: 10000,
          account_id: "cash1",
          transfer_account_id: "debt1",
          note: "Transfer sah",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
      debts: [{ id: "d1", transaction_id: "tx1", deleted_at: null }],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(0);
  });

  it("TIDAK mendeteksi transaksi transfer debt->debt (no-op by design)", async () => {
    const { db } = createFakeDb({
      accounts: [
        { id: "debt1", name: "Piutang A", account_type: "debt", deleted_at: null },
        { id: "debt2", name: "Piutang B", account_type: "debt", deleted_at: null },
      ],
      transactions: [
        {
          id: "tx1",
          type: "transfer",
          amount: 10000,
          account_id: "debt1",
          transfer_account_id: "debt2",
          note: "Transfer debt-debt",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(0);
  });

  it("TIDAK mendeteksi transaksi koreksi nominal arah NAIK (debt_amount_adjustments pasangan, bukan debts/debt_payments)", async () => {
    const { db } = createFakeDb({
      accounts: [{ id: "debt1", name: "SPayLater", account_type: "debt", deleted_at: null }],
      transactions: [
        {
          id: "tx1",
          type: "expense",
          amount: 10000,
          account_id: "debt1",
          transfer_account_id: null,
          note: "Koreksi nominal arah naik",
          date: "2026-10-20",
          deleted_at: null,
        },
      ],
      debtAmountAdjustments: [{ id: "a1", transaction_id: "tx1" }],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(0);
  });

  it("mendeteksi transaksi income/expense direct pada akun debt tanpa debt_payments pasangan", async () => {
    const { db } = createFakeDb({
      accounts: [{ id: "debt1", name: "Utang Dagang", account_type: "debt", deleted_at: null }],
      transactions: [
        {
          id: "tx1",
          type: "expense",
          amount: 5000,
          account_id: "debt1",
          transfer_account_id: null,
          note: "Direct yatim",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(1);
  });

  it("TIDAK mendeteksi transaksi income/expense direct pada akun debt yang punya debt_payments pasangan", async () => {
    const { db } = createFakeDb({
      accounts: [{ id: "debt1", name: "Utang Dagang", account_type: "debt", deleted_at: null }],
      transactions: [
        {
          id: "tx1",
          type: "income",
          amount: 5000,
          account_id: "debt1",
          transfer_account_id: null,
          note: "Pelunasan direct",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
      debtPayments: [{ id: "p1", transaction_id: "tx1", deleted_at: null }],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(0);
  });

  it("mendeteksi transaksi transfer cash->investment yang tidak punya baris investment_purchases pasangan", async () => {
    const { db } = createFakeDb({
      accounts: [
        { id: "cash1", name: "Dompet", account_type: "cash", deleted_at: null },
        { id: "inv1", name: "Reksadana X", account_type: "investment", deleted_at: null },
      ],
      transactions: [
        {
          id: "tx1",
          type: "transfer",
          amount: 100000,
          account_id: "cash1",
          transfer_account_id: "inv1",
          note: "Beli yatim",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "tx1", account_id: "inv1", account_type: "investment" });
  });

  it("TIDAK mendeteksi transaksi transfer investment->cash yang punya baris investment_sales pasangan", async () => {
    const { db } = createFakeDb({
      accounts: [
        { id: "cash1", name: "Dompet", account_type: "cash", deleted_at: null },
        { id: "inv1", name: "Reksadana X", account_type: "investment", deleted_at: null },
      ],
      transactions: [
        {
          id: "tx1",
          type: "transfer",
          amount: 50000,
          account_id: "inv1",
          transfer_account_id: "cash1",
          note: "Jual sah",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
      investmentSales: [{ id: "s1", transaction_id: "tx1", deleted_at: null }],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(0);
  });

  it("baris turunan yang sudah deleted_at (soft-deleted) TETAP dianggap yatim", async () => {
    const { db } = createFakeDb({
      accounts: [{ id: "debt1", name: "Utang Dagang", account_type: "debt", deleted_at: null }],
      transactions: [
        {
          id: "tx1",
          type: "expense",
          amount: 5000,
          account_id: "debt1",
          transfer_account_id: null,
          note: "x",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
      debtPayments: [{ id: "p1", transaction_id: "tx1", deleted_at: "2026-10-02" }],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(1);
  });

  it("akun yang sudah deleted_at diabaikan dari deteksi", async () => {
    const { db } = createFakeDb({
      accounts: [{ id: "debt1", name: "Utang Dagang", account_type: "debt", deleted_at: "2026-10-01" }],
      transactions: [
        {
          id: "tx1",
          type: "expense",
          amount: 5000,
          account_id: "debt1",
          transfer_account_id: null,
          note: "x",
          date: "2026-10-01",
          deleted_at: null,
        },
      ],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(0);
  });

  it("menggabungkan hasil debt dan investment, diurutkan dari tanggal terbaru", async () => {
    const { db } = createFakeDb({
      accounts: [
        { id: "debt1", name: "Utang Dagang", account_type: "debt", deleted_at: null },
        { id: "inv1", name: "Reksadana X", account_type: "investment", deleted_at: null },
      ],
      transactions: [
        {
          id: "tx1",
          type: "expense",
          amount: 5000,
          account_id: "debt1",
          transfer_account_id: null,
          note: "Lama",
          date: "2026-10-01",
          deleted_at: null,
        },
        {
          id: "tx2",
          type: "income",
          amount: 20000,
          account_id: "inv1",
          transfer_account_id: null,
          note: "Baru",
          date: "2026-10-05",
          deleted_at: null,
        },
      ],
    });

    const result = await checkBalanceConsistency(db);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("tx2");
    expect(result[1].id).toBe("tx1");
  });
});
