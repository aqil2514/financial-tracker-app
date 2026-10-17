import { describe, expect, it } from "vitest";

import { applyDirectDebtTransaction, DebtAccountDirectionMissingError } from "./index";

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
        return (account ? [{ name: account.name ?? account.id }] : []) as T;
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

const RECEIVABLE_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", name: "Piutang", debt_direction: "receivable" };
const PAYABLE_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", name: "Utang Dagang", debt_direction: "payable" };
const NO_DIRECTION_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", name: "Akun Debt Baru" };

describe("applyDirectDebtTransaction", () => {
  it("payable + expense melahirkan utang baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [PAYABLE_ACCOUNT] });

    await applyDirectDebtTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "expense",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 20000000,
      date: "2026-10-17",
      settleDebtIds: [],
    });

    expect(debts).toEqual([
      {
        id: expect.any(String),
        type: "payable",
        contact_id: "contact-10",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-10-17",
      },
    ]);
  });

  it("receivable + income melahirkan piutang baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [RECEIVABLE_ACCOUNT] });

    await applyDirectDebtTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "income",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 10000,
      date: "2026-10-17",
      settleDebtIds: [],
    });

    expect(debts).toEqual([
      {
        id: expect.any(String),
        type: "receivable",
        contact_id: "contact-10",
        amount: 10000,
        account_id: "debt-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-10-17",
      },
    ]);
  });

  it("payable + income melunasi utang ongoing lewat FIFO, bukan melahirkan piutang baru", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-100",
        status: "ongoing",
        date: "2026-10-17",
      },
    ];
    const { db, debts, debtPayments } = createFakeDb({ accounts: [PAYABLE_ACCOUNT], debts: seedDebts });

    await applyDirectDebtTransaction({
      db: db as never,
      transactionId: "tx-200",
      type: "income",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 20000000,
      date: "2026-10-18",
      settleDebtIds: ["debt-row-1"],
    });

    expect(debtPayments).toEqual([
      {
        id: expect.any(String),
        debt_id: "debt-row-1",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-200",
        date: "2026-10-18",
      },
    ]);
    expect(debts.find((d) => d.id === "debt-row-1")?.status).toBe("paid");
    expect(debts).toHaveLength(1);
  });

  it("receivable + expense melunasi piutang ongoing lewat FIFO, bukan melahirkan utang baru", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "receivable",
        contact_id: "contact-10",
        amount: 10000,
        account_id: "debt-1",
        transaction_id: "tx-100",
        status: "ongoing",
        date: "2026-10-17",
      },
    ];
    const { db, debts, debtPayments } = createFakeDb({ accounts: [RECEIVABLE_ACCOUNT], debts: seedDebts });

    await applyDirectDebtTransaction({
      db: db as never,
      transactionId: "tx-200",
      type: "expense",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 10000,
      date: "2026-10-18",
      settleDebtIds: ["debt-row-1"],
    });

    expect(debtPayments).toEqual([
      {
        id: expect.any(String),
        debt_id: "debt-row-1",
        amount: 10000,
        account_id: "debt-1",
        transaction_id: "tx-200",
        date: "2026-10-18",
      },
    ]);
    expect(debts.find((d) => d.id === "debt-row-1")?.status).toBe("paid");
    expect(debts).toHaveLength(1);
  });

  it("payable + income dengan settleDebtIds kosong tidak melakukan apa pun", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-100",
        status: "ongoing",
        date: "2026-10-17",
      },
    ];
    const { db, debtPayments } = createFakeDb({ accounts: [PAYABLE_ACCOUNT], debts: seedDebts });

    const result = await applyDirectDebtTransaction({
      db: db as never,
      transactionId: "tx-200",
      type: "income",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 20000000,
      date: "2026-10-18",
      settleDebtIds: [],
    });

    expect(debtPayments).toHaveLength(0);
    expect(result).toEqual({ debtIds: [], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] });
  });

  it("menolak income/expense langsung kalau akun debt tidak punya direction", async () => {
    const { db } = createFakeDb({ accounts: [NO_DIRECTION_ACCOUNT] });

    await expect(
      applyDirectDebtTransaction({
        db: db as never,
        transactionId: "tx-1",
        type: "expense",
        accountId: "debt-1",
        contactId: "contact-10",
        amount: 1000,
        date: "2026-10-17",
        settleDebtIds: [],
      })
    ).rejects.toThrow(DebtAccountDirectionMissingError);
  });
});
