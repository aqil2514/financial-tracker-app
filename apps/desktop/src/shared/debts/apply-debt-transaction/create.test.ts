import { describe, expect, it } from "vitest";

import { applyDebtTransaction, DebtAccountDirectionMissingError } from "./index";

type AccountRow = {
  id: string;
  account_type: "cash" | "debt";
  name?: string;
  debt_direction?: "receivable" | "payable";
};
type DebtRow = {
  id: string;
  type: "receivable" | "payable";
  contact_id: string | null;
  amount: number;
  account_id: string | null;
  transaction_id: string | null;
  status: "ongoing" | "paid" | "written_off";
  date: string;
};
type DebtPaymentRow = {
  id: string;
  debt_id: string;
  amount: number;
  account_id: string | null;
  transaction_id: string | null;
  date: string;
};

function createFakeDb(seed: { accounts?: AccountRow[]; debts?: DebtRow[]; debtPayments?: DebtPaymentRow[] } = {}) {
  const accounts = seed.accounts ?? [];
  const debts: DebtRow[] = seed.debts ?? [];
  const debtPayments: DebtPaymentRow[] = seed.debtPayments ?? [];

  function remaining(debtId: string): number {
    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return 0;
    const paid = debtPayments
      .filter((p) => p.debt_id === debtId)
      .reduce((sum, p) => sum + p.amount, 0);
    return debt.amount - paid;
  }

  const db = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      if (sql.includes("FROM debt_accounts")) {
        const [accountId] = params as [string];
        const account = accounts.find((a) => a.id === accountId);
        if (!account || account.debt_direction == null) return [] as T;
        return [{ name: account.name ?? account.id, direction: account.debt_direction }] as T;
      }
      if (sql.includes("FROM accounts WHERE id")) {
        const [id] = params as [string];
        const account = accounts.find((a) => a.id === id);
        if (sql.startsWith("SELECT name")) {
          return (account ? [{ name: account.name ?? account.id }] : []) as T;
        }
        return (account ? [{ account_type: account.account_type }] : []) as T;
      }
      if (sql.includes("FROM debts") && sql.includes("remaining") && sql.includes("IN (")) {
        const ids = params as string[];
        const rows = debts
          .filter((d) => ids.includes(d.id))
          .map((d) => ({ id: d.id, remaining: remaining(d.id) }))
          .sort((a, b) => {
            const da = debts.find((d) => d.id === a.id)!;
            const dbb = debts.find((d) => d.id === b.id)!;
            return da.date === dbb.date ? a.id.localeCompare(b.id) : da.date.localeCompare(dbb.date);
          });
        return rows as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("INSERT INTO debts")) {
        const [id, type, contactId, amount, accountId, transactionId, date] = params as [
          string,
          "receivable" | "payable",
          string | null,
          number,
          string,
          string,
          string,
        ];
        debts.push({
          id,
          type,
          contact_id: contactId,
          amount,
          account_id: accountId,
          transaction_id: transactionId,
          status: "ongoing",
          date,
        });
        return {};
      }
      if (sql.startsWith("UPDATE debts SET status = 'paid'")) {
        const [id] = params as [string];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.status = "paid";
        return {};
      }
      if (sql.startsWith("INSERT INTO debt_payments")) {
        const [id, debtId, amount, accountId, transactionId, date] = params as [
          string,
          string,
          number,
          string,
          string,
          string,
        ];
        debtPayments.push({ id, debt_id: debtId, amount, account_id: accountId, transaction_id: transactionId, date });
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db, accounts, debts, debtPayments };
}

const CASH_ACCOUNT: AccountRow = { id: "cash-1", account_type: "cash" };
const RECEIVABLE_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", name: "Piutang", debt_direction: "receivable" };
const PAYABLE_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", name: "Utang Dagang", debt_direction: "payable" };
const NO_DIRECTION_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", name: "Akun Debt Baru" };

describe("applyDebtTransaction", () => {
  it("tidak melakukan apa pun untuk transaksi income/expense", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, RECEIVABLE_ACCOUNT] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "expense",
      accountId: "cash-1",
      transferAccountId: null,
      contactId: null,
      amount: 1000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(debts).toHaveLength(0);
  });

  it("tidak melakukan apa pun untuk transfer kas ke kas", async () => {
    const cashB: AccountRow = { id: "cash-2", account_type: "cash" };
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, cashB] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "cash-2",
      contactId: null,
      amount: 1000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(debts).toHaveLength(0);
  });

  it("melempar UnsupportedAccountPairError untuk kombinasi tipe akun di luar cash/debt/cash-investment", async () => {
    const forexAccount = { id: "forex-1", account_type: "forex" } as unknown as AccountRow;
    const { db } = createFakeDb({ accounts: [CASH_ACCOUNT, forexAccount] });

    await expect(
      applyDebtTransaction({
        db: db as never,
        transactionId: "tx-1",
        type: "transfer",
        accountId: "cash-1",
        transferAccountId: "forex-1",
        contactId: null,
        amount: 1000,
        date: "2026-01-01",
        settleDebtIds: [],
      })
    ).rejects.toThrow(/belum didukung/);
  });

  it("tidak melakukan apa pun (no-op) untuk transfer cash -> investment", async () => {
    const investmentAccount = { id: "inv-1", account_type: "investment" } as unknown as AccountRow;
    const { db } = createFakeDb({ accounts: [CASH_ACCOUNT, investmentAccount] });

    const result = await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "inv-1",
      contactId: null,
      amount: 1000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(result).toEqual({ debtIds: [], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] });
  });

  it("tidak melakukan apa pun untuk transfer debt ke debt", async () => {
    const debtB: AccountRow = { id: "debt-2", account_type: "debt", debt_direction: "payable" };
    const { db, debts } = createFakeDb({ accounts: [RECEIVABLE_ACCOUNT, debtB] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "debt-1",
      transferAccountId: "debt-2",
      contactId: "contact-10",
      amount: 1000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(debts).toHaveLength(0);
  });

  it("kas -> debt(receivable) melahirkan piutang baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, RECEIVABLE_ACCOUNT] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-42",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "debt-1",
      contactId: "contact-10",
      amount: 50000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(debts).toEqual([
      {
        id: expect.any(String),
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ]);
  });

  it("kas -> debt(payable) melunasi utang ongoing lewat FIFO, bukan melahirkan piutang baru", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 30000,
        account_id: "debt-1",
        transaction_id: "tx-100",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts, debtPayments } = createFakeDb({ accounts: [CASH_ACCOUNT, PAYABLE_ACCOUNT], debts: seedDebts });

    await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-200",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "debt-1",
      contactId: "contact-10",
      amount: 30000,
      date: "2026-02-01",
      settleDebtIds: ["debt-row-1"],
    });

    expect(debtPayments).toEqual([
      { id: expect.any(String), debt_id: "debt-row-1", amount: 30000, account_id: "debt-1", transaction_id: "tx-200", date: "2026-02-01" },
    ]);
    expect(debts.find((d) => d.id === "debt-row-1")?.status).toBe("paid");
  });

  it("debt(payable) -> kas melahirkan utang baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, PAYABLE_ACCOUNT] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-7",
      type: "transfer",
      accountId: "debt-1",
      transferAccountId: "cash-1",
      contactId: "contact-20",
      amount: 30000,
      date: "2026-02-01",
      settleDebtIds: [],
    });

    expect(debts).toEqual([
      {
        id: expect.any(String),
        type: "payable",
        contact_id: "contact-20",
        amount: 30000,
        account_id: "debt-1",
        transaction_id: "tx-7",
        status: "ongoing",
        date: "2026-02-01",
      },
    ]);
  });

  it("debt(receivable) -> kas melunasi piutang ongoing lewat FIFO ke yang terlama dulu", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "receivable",
        contact_id: "contact-10",
        amount: 30000,
        account_id: "debt-1",
        transaction_id: "tx-100",
        status: "ongoing",
        date: "2026-01-01",
      },
      {
        id: "debt-row-2",
        type: "receivable",
        contact_id: "contact-10",
        amount: 40000,
        account_id: "debt-1",
        transaction_id: "tx-101",
        status: "ongoing",
        date: "2026-01-10",
      },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, RECEIVABLE_ACCOUNT],
      debts: seedDebts,
    });

    await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-200",
      type: "transfer",
      accountId: "debt-1",
      transferAccountId: "cash-1",
      contactId: "contact-10",
      amount: 60000,
      date: "2026-02-01",
      settleDebtIds: ["debt-row-1", "debt-row-2"],
    });

    expect(debtPayments).toEqual([
      { id: expect.any(String), debt_id: "debt-row-1", amount: 30000, account_id: "debt-1", transaction_id: "tx-200", date: "2026-02-01" },
      { id: expect.any(String), debt_id: "debt-row-2", amount: 30000, account_id: "debt-1", transaction_id: "tx-200", date: "2026-02-01" },
    ]);
    expect(debts.find((d) => d.id === "debt-row-1")?.status).toBe("paid");
    expect(debts.find((d) => d.id === "debt-row-2")?.status).toBe("ongoing");
  });

  it("settlement dengan settleDebtIds kosong tidak melakukan apa pun", async () => {
    const { db, debtPayments } = createFakeDb({ accounts: [CASH_ACCOUNT, RECEIVABLE_ACCOUNT] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "debt-1",
      transferAccountId: "cash-1",
      contactId: "contact-10",
      amount: 1000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(debtPayments).toHaveLength(0);
  });

  it("menolak transfer kas -> debt kalau akun debt tidak punya direction", async () => {
    const { db } = createFakeDb({ accounts: [CASH_ACCOUNT, NO_DIRECTION_ACCOUNT] });

    await expect(
      applyDebtTransaction({
        db: db as never,
        transactionId: "tx-1",
        type: "transfer",
        accountId: "cash-1",
        transferAccountId: "debt-1",
        contactId: "contact-10",
        amount: 1000,
        date: "2026-01-01",
        settleDebtIds: [],
      })
    ).rejects.toThrow(DebtAccountDirectionMissingError);
  });

  it("menolak transfer debt -> kas kalau akun debt tidak punya direction", async () => {
    const { db } = createFakeDb({ accounts: [CASH_ACCOUNT, NO_DIRECTION_ACCOUNT] });

    await expect(
      applyDebtTransaction({
        db: db as never,
        transactionId: "tx-1",
        type: "transfer",
        accountId: "debt-1",
        transferAccountId: "cash-1",
        contactId: "contact-10",
        amount: 1000,
        date: "2026-01-01",
        settleDebtIds: [],
      })
    ).rejects.toThrow(DebtAccountDirectionMissingError);
  });
});
