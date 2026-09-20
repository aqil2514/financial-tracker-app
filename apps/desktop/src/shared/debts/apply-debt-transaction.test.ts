import { beforeEach, describe, expect, it } from "vitest";

import {
  applyDebtTransaction,
  applyDebtTransactionEdit,
  DebtEditBlockedError,
} from "./apply-debt-transaction";
import type { TransactionDebtStatus } from "./use-transaction-debt-status";

/**
 * Fake DB in-memory yang meniru HANYA pola SQL spesifik yang benar-benar
 * dipakai apply-debt-transaction.ts — bukan SQL parser umum. Dipakai
 * (bukan mock modul @/lib/db) karena `db` diteruskan sebagai parameter
 * fungsi, bukan diimpor di dalamnya, dan menambah dependency SQLite asli
 * (mis. better-sqlite3) untuk sekadar unit test dianggap berlebihan untuk
 * cakupan logic yang diuji di sini (murni branching, bukan SQL itu sendiri
 * — SQL-nya sudah diverifikasi manual lewat simulasi di salinan
 * finance.dev.db, lihat debt-receivable-tracking.md).
 */
type AccountRow = { id: number; account_type: "cash" | "debt" };
type DebtRow = {
  id: number;
  type: "receivable" | "payable";
  contact_id: number | null;
  amount: number;
  account_id: number | null;
  transaction_id: number | null;
  status: "ongoing" | "paid" | "written_off";
  date: string;
};
type DebtPaymentRow = {
  id: number;
  debt_id: number;
  amount: number;
  account_id: number | null;
  transaction_id: number | null;
  date: string;
};

function createFakeDb(seed: { accounts?: AccountRow[]; debts?: DebtRow[]; debtPayments?: DebtPaymentRow[] } = {}) {
  const accounts = seed.accounts ?? [];
  const debts: DebtRow[] = seed.debts ?? [];
  const debtPayments: DebtPaymentRow[] = seed.debtPayments ?? [];
  let nextDebtId = Math.max(0, ...debts.map((d) => d.id)) + 1;
  let nextPaymentId = Math.max(0, ...debtPayments.map((p) => p.id)) + 1;

  function remaining(debtId: number): number {
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
        const [id] = params as [number];
        const account = accounts.find((a) => a.id === id);
        return (account ? [{ account_type: account.account_type }] : []) as T;
      }
      if (sql.includes("FROM debts") && sql.includes("remaining") && sql.includes("IN (")) {
        const ids = params as number[];
        const rows = debts
          .filter((d) => ids.includes(d.id))
          .map((d) => ({ id: d.id, remaining: remaining(d.id) }))
          .sort((a, b) => {
            const da = debts.find((d) => d.id === a.id)!;
            const dbb = debts.find((d) => d.id === b.id)!;
            return da.date === dbb.date ? a.id - b.id : da.date.localeCompare(dbb.date);
          });
        return rows as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("INSERT INTO debts")) {
        const [contactId, amount, accountId, transactionId, date] = params as [
          number | null,
          number,
          number,
          number,
          string,
        ];
        const type = sql.includes("'receivable'") ? "receivable" : "payable";
        const id = nextDebtId++;
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
        return { lastInsertId: id };
      }
      if (sql.startsWith("DELETE FROM debts")) {
        const [id] = params as [number];
        const index = debts.findIndex((d) => d.id === id);
        if (index >= 0) debts.splice(index, 1);
        // Simulasikan ON DELETE CASCADE debt_payments -> debts.
        for (let i = debtPayments.length - 1; i >= 0; i--) {
          if (debtPayments[i].debt_id === id) debtPayments.splice(i, 1);
        }
        return {};
      }
      if (sql.startsWith("UPDATE debts SET date")) {
        const [date, id] = params as [string, number];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.date = date;
        return {};
      }
      if (sql.startsWith("UPDATE debts SET status = 'paid'")) {
        const [id] = params as [number];
        const debt = debts.find((d) => d.id === id);
        if (debt) debt.status = "paid";
        return {};
      }
      if (sql.startsWith("UPDATE debts SET status = 'ongoing'")) {
        const [id] = params as [number];
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
        const [debtId, amount, accountId, transactionId, date] = params as [
          number,
          number,
          number,
          number,
          string,
        ];
        const id = nextPaymentId++;
        debtPayments.push({ id, debt_id: debtId, amount, account_id: accountId, transaction_id: transactionId, date });
        return { lastInsertId: id };
      }
      if (sql.startsWith("DELETE FROM debt_payments")) {
        const [id] = params as [number];
        const index = debtPayments.findIndex((p) => p.id === id);
        if (index >= 0) debtPayments.splice(index, 1);
        return {};
      }
      if (sql.startsWith("UPDATE debt_payments SET date")) {
        const [date, id] = params as [string, number];
        const payment = debtPayments.find((p) => p.id === id);
        if (payment) payment.date = date;
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db, accounts, debts, debtPayments };
}

const CASH_ACCOUNT: AccountRow = { id: 1, account_type: "cash" };
const DEBT_ACCOUNT: AccountRow = { id: 2, account_type: "debt" };

describe("applyDebtTransaction", () => {
  it("tidak melakukan apa pun untuk transaksi income/expense", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: 1,
      type: "expense",
      accountId: 1,
      transferAccountId: null,
      contactId: null,
      amount: 1000,
      date: "2026-01-01",
      debtAction: null,
      settleDebtIds: [],
    });

    expect(debts).toHaveLength(0);
  });

  it("tidak melakukan apa pun untuk transfer kas ke kas", async () => {
    const cashB: AccountRow = { id: 3, account_type: "cash" };
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, cashB] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: 1,
      type: "transfer",
      accountId: 1,
      transferAccountId: 3,
      contactId: null,
      amount: 1000,
      date: "2026-01-01",
      debtAction: null,
      settleDebtIds: [],
    });

    expect(debts).toHaveLength(0);
  });

  it("tidak melakukan apa pun untuk transfer debt ke debt", async () => {
    const debtB: AccountRow = { id: 3, account_type: "debt" };
    const { db, debts } = createFakeDb({ accounts: [DEBT_ACCOUNT, debtB] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: 1,
      type: "transfer",
      accountId: 2,
      transferAccountId: 3,
      contactId: 10,
      amount: 1000,
      date: "2026-01-01",
      debtAction: null,
      settleDebtIds: [],
    });

    expect(debts).toHaveLength(0);
  });

  it("kas -> debt otomatis membuat piutang baru (receivable)", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: 42,
      type: "transfer",
      accountId: 1,
      transferAccountId: 2,
      contactId: 10,
      amount: 50000,
      date: "2026-01-01",
      debtAction: null,
      settleDebtIds: [],
    });

    expect(debts).toEqual([
      {
        id: 1,
        type: "receivable",
        contact_id: 10,
        amount: 50000,
        account_id: 2,
        transaction_id: 42,
        status: "ongoing",
        date: "2026-01-01",
      },
    ]);
  });

  it("debt -> kas dengan debtAction='payable' membuat utang baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: 7,
      type: "transfer",
      accountId: 2,
      transferAccountId: 1,
      contactId: 20,
      amount: 30000,
      date: "2026-02-01",
      debtAction: "payable",
      settleDebtIds: [],
    });

    expect(debts).toEqual([
      {
        id: 1,
        type: "payable",
        contact_id: 20,
        amount: 30000,
        account_id: 2,
        transaction_id: 7,
        status: "ongoing",
        date: "2026-02-01",
      },
    ]);
  });

  it("debt -> kas dengan debtAction='settlement' mengalokasikan FIFO ke piutang terlama dulu", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: 1,
        type: "receivable",
        contact_id: 10,
        amount: 30000,
        account_id: 2,
        transaction_id: 100,
        status: "ongoing",
        date: "2026-01-01",
      },
      {
        id: 2,
        type: "receivable",
        contact_id: 10,
        amount: 40000,
        account_id: 2,
        transaction_id: 101,
        status: "ongoing",
        date: "2026-01-10",
      },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
    });

    await applyDebtTransaction({
      db: db as never,
      transactionId: 200,
      type: "transfer",
      accountId: 2,
      transferAccountId: 1,
      contactId: 10,
      amount: 60000,
      date: "2026-02-01",
      debtAction: "settlement",
      settleDebtIds: ["1", "2"],
    });

    // Debt 1 (30000, TERLAMA) lunas penuh duluan, sisa 30000 dari 60000
    // mengalir ke debt 2 (40000) -> debt 2 sisa 10000, masih ongoing.
    expect(debtPayments).toEqual([
      { id: 1, debt_id: 1, amount: 30000, account_id: 2, transaction_id: 200, date: "2026-02-01" },
      { id: 2, debt_id: 2, amount: 30000, account_id: 2, transaction_id: 200, date: "2026-02-01" },
    ]);
    expect(debts.find((d) => d.id === 1)?.status).toBe("paid");
    expect(debts.find((d) => d.id === 2)?.status).toBe("ongoing");
  });

  it("settlement dengan settleDebtIds kosong tidak melakukan apa pun", async () => {
    const { db, debtPayments } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT] });

    await applyDebtTransaction({
      db: db as never,
      transactionId: 1,
      type: "transfer",
      accountId: 2,
      transferAccountId: 1,
      contactId: 10,
      amount: 1000,
      date: "2026-01-01",
      debtAction: "settlement",
      settleDebtIds: [],
    });

    expect(debtPayments).toHaveLength(0);
  });
});

describe("applyDebtTransactionEdit", () => {
  const baseInput = {
    transactionId: 42,
    type: "transfer" as const,
    accountId: 1,
    transferAccountId: 2,
    contactId: 10,
    amount: 50000,
    date: "2026-03-01",
    debtAction: null,
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
    expect(debts[0].transaction_id).toBe(42);
  });

  it("role='principal', field berbahaya TIDAK berubah: cuma sinkronkan date", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: 5,
        type: "receivable",
        contact_id: 10,
        amount: 50000,
        account_id: 2,
        transaction_id: 42,
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT], debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: 5, hasPayments: false };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      date: "2026-03-15",
      status,
      dangerousFieldsChanged: false,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].date).toBe("2026-03-15");
    expect(debts[0].amount).toBe(50000); // tidak berubah
  });

  it("role='principal', field berbahaya berubah, BELUM ada cicilan: recreate dari nilai baru", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: 5,
        type: "receivable",
        contact_id: 10,
        amount: 50000,
        account_id: 2,
        transaction_id: 42,
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [CASH_ACCOUNT, DEBT_ACCOUNT], debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: 5, hasPayments: false };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      amount: 75000, // nominal berubah
      status,
      dangerousFieldsChanged: true,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].id).not.toBe(5); // baris lama sudah dihapus, ini baris baru
    expect(debts[0].amount).toBe(75000);
    expect(debts[0].transaction_id).toBe(42);
  });

  it("role='principal', field berbahaya berubah, SUDAH ada cicilan dari transaksi lain: DIBLOKIR", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: 5,
        type: "receivable",
        contact_id: 10,
        amount: 50000,
        account_id: 2,
        transaction_id: 42,
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: 1, debt_id: 5, amount: 20000, account_id: 1, transaction_id: 999, date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "principal", debtId: 5, hasPayments: true };

    await expect(
      applyDebtTransactionEdit({
        db: db as never,
        ...baseInput,
        amount: 75000,
        status,
        dangerousFieldsChanged: true,
      })
    ).rejects.toThrow(DebtEditBlockedError);

    // Tidak ada apa pun yang berubah — blokir terjadi SEBELUM mutasi apa pun.
    expect(debts).toHaveLength(1);
    expect(debts[0].amount).toBe(50000);
    expect(debtPayments).toHaveLength(1);
  });

  it("role='payment', field berbahaya TIDAK berubah: cuma sinkronkan date", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: 5,
        type: "receivable",
        contact_id: 10,
        amount: 50000,
        account_id: 2,
        transaction_id: 999,
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: 8, debt_id: 5, amount: 20000, account_id: 1, transaction_id: 42, date: "2026-02-01" },
    ];
    const { db, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: 8, debtId: 5 };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      date: "2026-02-20",
      status,
      dangerousFieldsChanged: false,
    });

    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].date).toBe("2026-02-20");
    expect(debtPayments[0].amount).toBe(20000); // tidak berubah
  });

  it("role='payment', field berbahaya berubah: recreate aman, debt induk tetap ongoing kalau masih ada sisa", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: 5,
        type: "receivable",
        contact_id: 10,
        amount: 50000,
        account_id: 2,
        transaction_id: 999,
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: 8, debt_id: 5, amount: 20000, account_id: 1, transaction_id: 42, date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: 8, debtId: 5 };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      accountId: 2,
      transferAccountId: 1,
      amount: 25000, // nominal cicilan berubah
      debtAction: "settlement",
      settleDebtIds: ["5"],
      status,
      dangerousFieldsChanged: true,
    });

    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].id).not.toBe(8); // baris lama sudah dihapus
    expect(debtPayments[0].amount).toBe(25000);
    expect(debts.find((d) => d.id === 5)?.status).toBe("ongoing"); // sisa 25000, belum lunas
  });

  it("role='payment', field berbahaya berubah, pembayaran BARU melunasi penuh: debt induk jadi paid", async () => {
    const seedDebts: DebtRow[] = [
      {
        id: 5,
        type: "receivable",
        contact_id: 10,
        amount: 50000,
        account_id: 2,
        transaction_id: 999,
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: DebtPaymentRow[] = [
      { id: 8, debt_id: 5, amount: 20000, account_id: 1, transaction_id: 42, date: "2026-02-01" },
    ];
    const { db, debts } = createFakeDb({
      accounts: [CASH_ACCOUNT, DEBT_ACCOUNT],
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: 8, debtId: 5 };

    await applyDebtTransactionEdit({
      db: db as never,
      ...baseInput,
      accountId: 2,
      transferAccountId: 1,
      amount: 50000, // melunasi seluruh sisa
      debtAction: "settlement",
      settleDebtIds: ["5"],
      status,
      dangerousFieldsChanged: true,
    });

    expect(debts.find((d) => d.id === 5)?.status).toBe("paid");
  });
});
