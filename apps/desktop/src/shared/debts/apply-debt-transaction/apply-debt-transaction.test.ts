import { describe, expect, it } from "vitest";

import {
  applyDebtTransactionEdit,
  detachDebtForDeletedTransaction,
  DebtEditBlockedError,
} from "./index";
import type { TransactionDebtStatus } from "../use-transaction-debt-status";

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
      if (sql.startsWith("SELECT id FROM debts WHERE transaction_id")) {
        const [transactionId] = params as [string];
        const match = debts.find((d) => d.transaction_id === transactionId);
        return (match ? [{ id: match.id }] : []) as T;
      }
      if (sql.startsWith("SELECT EXISTS(SELECT 1 FROM debt_payments WHERE debt_id")) {
        const [debtId] = params as [string];
        const found = debtPayments.some((p) => p.debt_id === debtId) ? 1 : 0;
        return [{ found }] as T;
      }
      if (sql.startsWith("SELECT id, debt_id FROM debt_payments WHERE transaction_id")) {
        const [transactionId] = params as [string];
        const match = debtPayments.find((p) => p.transaction_id === transactionId);
        return (match ? [{ id: match.id, debt_id: match.debt_id }] : []) as T;
      }
      if (sql.includes("FROM debt_accounts")) {
        const [accountId] = params as [string];
        const account = accounts.find((a) => a.id === accountId);
        if (!account || account.debt_direction == null) return [] as T;
        return [{ name: account.name ?? account.id, direction: account.debt_direction }] as T;
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
      if (sql.startsWith("DELETE FROM debts")) {
        const [id] = params as [string];
        const index = debts.findIndex((d) => d.id === id);
        if (index >= 0) debts.splice(index, 1);
        for (let i = debtPayments.length - 1; i >= 0; i--) {
          if (debtPayments[i].debt_id === id) debtPayments.splice(i, 1);
        }
        return {};
      }
      if (sql.startsWith("UPDATE debts SET date")) {
        const [date, id] = params as [string, string];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.date = date;
        return {};
      }
      if (sql.startsWith("UPDATE debts SET status = 'paid'")) {
        const [id] = params as [string];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.status = "paid";
        return {};
      }
      if (sql.startsWith("UPDATE debts SET status = 'ongoing'")) {
        const [id] = params as [string];
        const debt = debts.find((d) => d.id === id && d.status === "paid");
        const totalPaid = debtPayments
          .filter((p) => p.debt_id === id)
          .reduce((sum, p) => sum + p.amount, 0);
        if (debt && debt.amount > totalPaid) {
          debt.status = "ongoing";
        }
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
      if (sql.startsWith("UPDATE debts SET transaction_id = NULL")) {
        const [id] = params as [string];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.transaction_id = null;
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db, accounts, debts, debtPayments };
}

const CASH_ACCOUNT: AccountRow = { id: "cash-1", account_type: "cash" };
const DEBT_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", debt_direction: "receivable" };

describe("applyDebtTransactionEdit", () => {
  const baseInput = {
    transactionId: "tx-42",
    type: "transfer" as const,
    accountId: "cash-1",
    transferAccountId: "debt-1",
    contactId: "contact-10",
    amount: 50000,
    date: "2026-03-01",
    settleDebtIds: [] as string[],
  };

  it("role='none': berperilaku sama seperti applyDebtTransaction (create)", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT] });
    const status: TransactionDebtStatus = { role: "none" };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      status,
      dangerousFieldsChanged: false,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].transaction_id).toBe("tx-42");
  });

  it("role='principal', field berbahaya TIDAK berubah: cuma sinkronkan date", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT], debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: false };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      date: "2026-03-15",
      status,
      dangerousFieldsChanged: false,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].date).toBe("2026-03-15");
    expect(debts[0].amount).toBe(50000);
  });

  it("role='principal', field berbahaya berubah, BELUM ada cicilan: recreate dari nilai baru", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT], debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: false };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      amount: 75000,
      status,
      dangerousFieldsChanged: true,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].id).not.toBe("debt-row-5");
    expect(debts[0].amount).toBe(75000);
    expect(debts[0].transaction_id).toBe("tx-42");
  });

  it("role='principal', field berbahaya berubah, SUDAH ada cicilan dari transaksi lain: DIBLOKIR", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-999", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: true };

    await expect(
      applyDebtTransactionEdit({
        db: db as never,
        ...baseInput,
        amount: 75000,
        status,
        dangerousFieldsChanged: true,
      })
    ).rejects.toThrow(DebtEditBlockedError);

    expect(debts).toHaveLength(1);
    expect(debts[0].amount).toBe(50000);
    expect(debtPayments).toHaveLength(1);
  });

  it("role='payment', field berbahaya TIDAK berubah: cuma sinkronkan date", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-8", debtId: "debt-row-5" };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      date: "2026-02-20",
      status,
      dangerousFieldsChanged: false,
    });

    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].date).toBe("2026-02-20");
    expect(debtPayments[0].amount).toBe(20000);
  });

  it("role='payment', field berbahaya berubah: recreate aman, debt induk tetap ongoing kalau masih ada sisa", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-8", debtId: "debt-row-5" };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      accountId: "debt-1",
      transferAccountId: "cash-1",
      amount: 25000,
      settleDebtIds: ["debt-row-5"],
      status,
      dangerousFieldsChanged: true,
    });

    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].id).not.toBe("payment-8");
    expect(debtPayments[0].amount).toBe(25000);
    expect(debts.find((d) => d.id === "debt-row-5")?.status).toBe("ongoing");
  });

  it("role='payment', field berbahaya berubah, pembayaran BARU melunasi penuh: debt induk jadi paid", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-8", debtId: "debt-row-5" };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      accountId: "debt-1",
      transferAccountId: "cash-1",
      amount: 50000,
      settleDebtIds: ["debt-row-5"],
      status,
      dangerousFieldsChanged: true,
    });

    expect(debts.find((d) => d.id === "debt-row-5")?.status).toBe("paid");
  });
});

describe("detachDebtForDeletedTransaction", () => {
  it("role='none': no-op, tidak menyentuh apa pun", async () => {
    const { db, debts, debtPayments } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT] });

    const result = await detachDebtForDeletedTransaction(db as never, "tx-biasa");

    expect(result).toEqual({ role: "none" });
    expect(debts).toHaveLength(0);
    expect(debtPayments).toHaveLength(0);
  });

  it("role='principal', belum dicicil: transaction_id SET NULL, debt tetap utuh", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT], debts: seedDebts });

    const result = await detachDebtForDeletedTransaction(db as never, "tx-42");

    expect(result).toEqual({ role: "principal", debtId: "debt-row-5", hadPayments: false });
    expect(debts).toHaveLength(1);
    expect(debts[0].transaction_id).toBeNull();
    expect(debts[0].amount).toBe(50000);
    expect(debts[0].status).toBe("ongoing");
  });

  it("role='principal', SUDAH dicicil dari transaksi lain: transaction_id SET NULL, cicilan TIDAK tersentuh", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-999", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });

    const result = await detachDebtForDeletedTransaction(db as never, "tx-42");

    expect(result).toEqual({ role: "principal", debtId: "debt-row-5", hadPayments: true });
    expect(debts[0].transaction_id).toBeNull();
    expect(debts[0].amount).toBe(50000);
    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].id).toBe("payment-1");
    expect(debtPayments[0].transaction_id).toBe("tx-999");
  });

  it("role='payment', debt BELUM lunas: hapus debt_payments ini saja, status tidak berubah", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });

    const result = await detachDebtForDeletedTransaction(db as never, "tx-42");

    expect(result).toEqual({ role: "payment", debtId: "debt-row-5" });
    expect(debtPayments).toHaveLength(0);
    expect(debts[0].status).toBe("ongoing");
    expect(debts[0].amount).toBe(50000);
  });

  it("role='payment', menghapus cicilan yang MELUNASI penuh: debt direvert dari 'paid' ke 'ongoing'", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "paid",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 50000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });

    const result = await detachDebtForDeletedTransaction(db as never, "tx-42");

    expect(result).toEqual({ role: "payment", debtId: "debt-row-5" });
    expect(debtPayments).toHaveLength(0);
    expect(debts[0].status).toBe("ongoing");
  });
});
