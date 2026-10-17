import { describe, expect, it } from "vitest";

import {
  applyDirectDebtTransactionEdit,
  DebtEditBlockedError,
  DebtSelfSettlementError,
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
    const paid = debtPayments.filter((p) => p.debt_id === debtId).reduce((sum, p) => sum + p.amount, 0);
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
        const debt = debts.find((d) => d.id === id);
        if (debt && debt.status === "paid" && remaining(id) > 0) debt.status = "ongoing";
        return {};
      }
      if (sql.startsWith("DELETE FROM debts WHERE id")) {
        const [id] = params as [string];
        const idx = debts.findIndex((d) => d.id === id);
        if (idx >= 0) debts.splice(idx, 1);
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
      if (sql.startsWith("UPDATE debt_payments SET date")) {
        const [date, id] = params as [string, string];
        const payment = debtPayments.find((p) => p.id === id);
        if (payment) payment.date = date;
        return {};
      }
      if (sql.startsWith("DELETE FROM debt_payments WHERE id")) {
        const [id] = params as [string];
        const idx = debtPayments.findIndex((p) => p.id === id);
        if (idx >= 0) debtPayments.splice(idx, 1);
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db, accounts, debts, debtPayments };
}

const PAYABLE_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", name: "Utang Dagang", debt_direction: "payable" };
const RECEIVABLE_ACCOUNT: AccountRow = { id: "debt-1", account_type: "debt", name: "Piutang", debt_direction: "receivable" };

describe("applyDirectDebtTransactionEdit", () => {
  it("role 'none' berperilaku sama seperti create", async () => {
    const { db, debts } = createFakeDb({ accounts: [PAYABLE_ACCOUNT] });
    const status: TransactionDebtStatus = { role: "none" };

    await applyDirectDebtTransactionEdit({
      db: db as never,
      transactionId: "tx-1",
      type: "expense",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 20000000,
      date: "2026-10-17",
      settleDebtIds: [],
      status,
      dangerousFieldsChanged: true,
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

  it("role 'principal', field berbahaya TIDAK berubah: cuma sinkronkan tanggal", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-10-17",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [PAYABLE_ACCOUNT], debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-1", hasPayments: false };

    await applyDirectDebtTransactionEdit({
      db: db as never,
      transactionId: "tx-1",
      type: "expense",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 20000000,
      date: "2026-10-18",
      settleDebtIds: [],
      status,
      dangerousFieldsChanged: false,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].date).toBe("2026-10-18");
  });

  it("role 'principal', field berbahaya berubah, SUDAH dicicil: DIBLOKIR", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-10-17",
      },
    ];
    const { db } = createFakeDb({ accounts: [PAYABLE_ACCOUNT], debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-1", hasPayments: true };

    await expect(
      applyDirectDebtTransactionEdit({
        db: db as never,
        transactionId: "tx-1",
        type: "expense",
        accountId: "debt-1",
        contactId: "contact-10",
        amount: 25000000,
        date: "2026-10-17",
        settleDebtIds: [],
        status,
        dangerousFieldsChanged: true,
      })
    ).rejects.toThrow(DebtEditBlockedError);
  });

  it("role 'principal', field berbahaya berubah, belum dicicil: recreate (hapus lama, buat baru)", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-10-17",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [PAYABLE_ACCOUNT], debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-1", hasPayments: false };

    const result = await applyDirectDebtTransactionEdit({
      db: db as never,
      transactionId: "tx-1",
      type: "expense",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 25000000,
      date: "2026-10-17",
      settleDebtIds: [],
      status,
      dangerousFieldsChanged: true,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].id).not.toBe("debt-row-1");
    expect(debts[0].amount).toBe(25000000);
    expect(result.deletedDebtIds).toEqual(["debt-row-1"]);
  });

  it("role 'principal', recreate tapi settleDebtIds menyertakan debt miliknya sendiri: DebtSelfSettlementError", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-10-17",
      },
    ];
    const { db } = createFakeDb({ accounts: [PAYABLE_ACCOUNT], debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-1", hasPayments: false };

    await expect(
      applyDirectDebtTransactionEdit({
        db: db as never,
        transactionId: "tx-1",
        type: "income",
        accountId: "debt-1",
        contactId: "contact-10",
        amount: 5000,
        date: "2026-10-17",
        settleDebtIds: ["debt-row-1"],
        status,
        dangerousFieldsChanged: true,
      })
    ).rejects.toThrow(DebtSelfSettlementError);
  });

  it("role 'payment', field berbahaya TIDAK berubah: cuma sinkronkan tanggal pembayaran", async () => {
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
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-row-1", amount: 5000000, account_id: "debt-1", transaction_id: "tx-200", date: "2026-10-18" },
    ];
    const { db, debtPayments } = createFakeDb({ accounts: [PAYABLE_ACCOUNT], debts: seedDebts, debtPayments: seedPayments });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-1", debtId: "debt-row-1" };

    await applyDirectDebtTransactionEdit({
      db: db as never,
      transactionId: "tx-200",
      type: "income",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 5000000,
      date: "2026-10-19",
      settleDebtIds: ["debt-row-1"],
      status,
      dangerousFieldsChanged: false,
    });

    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].date).toBe("2026-10-19");
  });

  it("role 'payment', field berbahaya berubah: recreate pembayaran lewat FIFO baru", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 20000000,
        account_id: "debt-1",
        transaction_id: "tx-100",
        status: "paid",
        date: "2026-10-17",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-row-1", amount: 20000000, account_id: "debt-1", transaction_id: "tx-200", date: "2026-10-18" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [PAYABLE_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-1", debtId: "debt-row-1" };

    const result = await applyDirectDebtTransactionEdit({
      db: db as never,
      transactionId: "tx-200",
      type: "income",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 5000000,
      date: "2026-10-19",
      settleDebtIds: ["debt-row-1"],
      status,
      dangerousFieldsChanged: true,
    });

    expect(debtPayments.find((p) => p.id === "payment-1")).toBeUndefined();
    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].amount).toBe(5000000);
    expect(debts.find((d) => d.id === "debt-row-1")?.status).toBe("ongoing");
    expect(result.deletedDebtPaymentIds).toEqual(["payment-1"]);
  });

  it("receivable + expense (pelunasan) tetap jalan lewat jalur edit role 'none'", async () => {
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
    const status: TransactionDebtStatus = { role: "none" };

    await applyDirectDebtTransactionEdit({
      db: db as never,
      transactionId: "tx-200",
      type: "expense",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 10000,
      date: "2026-10-18",
      settleDebtIds: ["debt-row-1"],
      status,
      dangerousFieldsChanged: true,
    });

    expect(debtPayments).toHaveLength(1);
    expect(debts.find((d) => d.id === "debt-row-1")?.status).toBe("paid");
  });
});
