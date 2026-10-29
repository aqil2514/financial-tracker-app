import type { Db } from "./types";

export type FakeAccountRow = { id: string; account_type: "cash" | "debt"; name?: string };
export type FakeDebtAccountRow = { account_id: string; direction: "receivable" | "payable" };
export type FakeDebtRow = {
  id: string;
  type: "receivable" | "payable";
  contact_id: string | null;
  amount: number;
  account_id: string | null;
  transaction_id: string | null;
  status: "ongoing" | "paid" | "written_off";
  date: string;
};
export type FakeDebtPaymentRow = {
  id: string;
  debt_id: string;
  amount: number;
  account_id: string | null;
  transaction_id: string | null;
  date: string;
};

// Fake in-memory db yang mengenali pola query yang dipakai shared/debts/
// — dipakai bareng di *.test.ts file ini (tidak match glob src/**/*.test.ts
// karena bukan diakhiri .test.ts, jadi tidak dianggap test suite sendiri).
export function createFakeDb(
  seed: {
    accounts?: FakeAccountRow[];
    debtAccounts?: FakeDebtAccountRow[];
    debts?: FakeDebtRow[];
    debtPayments?: FakeDebtPaymentRow[];
  } = {}
) {
  const accounts = seed.accounts ?? [];
  const debtAccounts = seed.debtAccounts ?? [];
  const debts: FakeDebtRow[] = seed.debts ?? [];
  const debtPayments: FakeDebtPaymentRow[] = seed.debtPayments ?? [];

  function remaining(debtId: string): number {
    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return 0;
    const paid = debtPayments.filter((p) => p.debt_id === debtId).reduce((sum, p) => sum + p.amount, 0);
    return debt.amount - paid;
  }

  const db: Db = {
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      if (sql.includes("FROM accounts WHERE id") && sql.includes("account_type") && !sql.includes("debt_accounts")) {
        const [id] = params as [string];
        const account = accounts.find((a) => a.id === id);
        return (account ? { account_type: account.account_type } : null) as T | null;
      }
      if (sql.includes("FROM accounts") && sql.includes("debt_accounts")) {
        const [id] = params as [string];
        const account = accounts.find((a) => a.id === id);
        if (!account) return null as T | null;
        const debtAccount = debtAccounts.find((da) => da.account_id === id);
        return { name: account.name ?? account.id, direction: debtAccount?.direction ?? null } as T;
      }
      if (sql.startsWith("SELECT id FROM debts WHERE transaction_id")) {
        const [transactionId] = params as [string];
        const match = debts.find((d) => d.transaction_id === transactionId);
        return (match ? { id: match.id } : null) as T | null;
      }
      if (sql.startsWith("SELECT EXISTS(SELECT 1 FROM debt_payments WHERE debt_id")) {
        const [debtId] = params as [string];
        const found = debtPayments.some((p) => p.debt_id === debtId) ? 1 : 0;
        return { found } as T;
      }
      if (sql.startsWith("SELECT id, debt_id FROM debt_payments WHERE transaction_id")) {
        const [transactionId] = params as [string];
        const match = debtPayments.find((p) => p.transaction_id === transactionId);
        return (match ? { id: match.id, debt_id: match.debt_id } : null) as T | null;
      }
      if (sql.startsWith("SELECT contact_id FROM debts WHERE id")) {
        const [debtId] = params as [string];
        const debt = debts.find((d) => d.id === debtId);
        return (debt ? { contact_id: debt.contact_id } : null) as T | null;
      }
      throw new Error(`Fake db.getFirstAsync tidak mengenali query: ${sql}`);
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (sql.includes("FROM debts") && sql.includes("remaining") && sql.includes("IN (")) {
        const ids = params as string[];
        return debts
          .filter((d) => ids.includes(d.id))
          .map((d) => ({ id: d.id, remaining: remaining(d.id) }))
          .sort((a, b) => {
            const da = debts.find((d) => d.id === a.id)!;
            const dbb = debts.find((d) => d.id === b.id)!;
            return da.date === dbb.date ? a.id.localeCompare(b.id) : da.date.localeCompare(dbb.date);
          }) as T[];
      }
      throw new Error(`Fake db.getAllAsync tidak mengenali query: ${sql}`);
    },
    async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
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
      if (sql.startsWith("UPDATE debts SET status = 'paid'")) {
        const [id] = params as [string];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.status = "paid";
        return {};
      }
      if (sql.startsWith("UPDATE debts SET date")) {
        const [date, id] = params as [string, string];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.date = date;
        return {};
      }
      if (sql.startsWith("UPDATE debts SET transaction_id = NULL")) {
        const [id] = params as [string];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.transaction_id = null;
        return {};
      }
      if (sql.startsWith("UPDATE debts SET status = 'ongoing'")) {
        const [id] = params as [string];
        const debt = debts.find((d) => d.id === id && d.status === "paid");
        const totalPaid = debtPayments.filter((p) => p.debt_id === id).reduce((sum, p) => sum + p.amount, 0);
        if (debt && debt.amount > totalPaid) {
          debt.status = "ongoing";
        }
        return {};
      }
      if (sql.startsWith("DELETE FROM debts")) {
        const [id] = params as [string];
        const index = debts.findIndex((d) => d.id === id);
        if (index >= 0) debts.splice(index, 1);
        return {};
      }
      if (sql.startsWith("DELETE FROM debt_payments")) {
        const [id] = params as [string];
        const index = debtPayments.findIndex((p) => p.id === id);
        if (index >= 0) debtPayments.splice(index, 1);
        return {};
      }
      if (sql.startsWith("UPDATE debt_payments SET date")) {
        const [date, id] = params as [string, string];
        const payment = debtPayments.find((p) => p.id === id);
        if (payment) payment.date = date;
        return {};
      }
      throw new Error(`Fake db.runAsync tidak mengenali query: ${sql}`);
    },
  } as unknown as Db;

  return { db, accounts, debtAccounts, debts, debtPayments };
}
