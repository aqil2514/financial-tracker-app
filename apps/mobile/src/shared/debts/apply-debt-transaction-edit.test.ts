import { describe, expect, it } from "vitest";
import {
  applyDebtTransactionEdit,
  DebtEditBlockedError,
  DebtSelfSettlementError,
} from "./apply-debt-transaction-edit";
import type { TransactionDebtStatus } from "./transaction-debt-status";
import { createFakeDb, type FakeAccountRow, type FakeDebtAccountRow, type FakeDebtRow, type FakeDebtPaymentRow } from "./create-fake-db";

const CASH: FakeAccountRow = { id: "cash-1", account_type: "cash" };
const RECEIVABLE_DEBT: FakeAccountRow = { id: "debt-1", account_type: "debt" };
const DEBT_ACCOUNTS: FakeDebtAccountRow[] = [{ account_id: "debt-1", direction: "receivable" }];

const BASE_INPUT = {
  transactionId: "tx-42",
  type: "transfer" as const,
  accountId: "cash-1",
  transferAccountId: "debt-1",
  contactId: "contact-10",
  amount: 50000,
  date: "2026-03-01",
  settleDebtIds: [] as string[],
};

describe("applyDebtTransactionEdit", () => {
  it("role 'none': berperilaku sama seperti create baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH, RECEIVABLE_DEBT], debtAccounts: DEBT_ACCOUNTS });
    const status: TransactionDebtStatus = { role: "none" };

    await applyDebtTransactionEdit({ db, ...BASE_INPUT, status, dangerousFieldsChanged: false });

    expect(debts).toHaveLength(1);
    expect(debts[0].transaction_id).toBe("tx-42");
  });

  it("role 'principal', field berbahaya TIDAK berubah: cuma sinkronkan date", async () => {
    const seedDebts: FakeDebtRow[] = [
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
    const { db, debts } = createFakeDb({ accounts: [CASH, RECEIVABLE_DEBT], debtAccounts: DEBT_ACCOUNTS, debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: false };

    await applyDebtTransactionEdit({
      db,
      ...BASE_INPUT,
      date: "2026-03-15",
      status,
      dangerousFieldsChanged: false,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].date).toBe("2026-03-15");
    expect(debts[0].amount).toBe(50000);
  });

  it("role 'principal', field berbahaya berubah, BELUM ada cicilan: recreate dari nilai baru", async () => {
    const seedDebts: FakeDebtRow[] = [
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
    const { db, debts } = createFakeDb({ accounts: [CASH, RECEIVABLE_DEBT], debtAccounts: DEBT_ACCOUNTS, debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: false };

    await applyDebtTransactionEdit({
      db,
      ...BASE_INPUT,
      amount: 75000,
      status,
      dangerousFieldsChanged: true,
    });

    expect(debts).toHaveLength(1);
    expect(debts[0].id).not.toBe("debt-row-5");
    expect(debts[0].amount).toBe(75000);
    expect(debts[0].transaction_id).toBe("tx-42");
  });

  it("role 'principal', field berbahaya berubah, SUDAH ada cicilan dari transaksi lain: DIBLOKIR", async () => {
    const seedDebts: FakeDebtRow[] = [
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
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-999", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH, RECEIVABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: true };

    await expect(
      applyDebtTransactionEdit({ db, ...BASE_INPUT, amount: 75000, status, dangerousFieldsChanged: true })
    ).rejects.toThrow(DebtEditBlockedError);

    expect(debts).toHaveLength(1);
    expect(debts[0].amount).toBe(50000);
    expect(debtPayments).toHaveLength(1);
  });

  it("role 'principal', mencoba melunasi debt miliknya sendiri: DebtSelfSettlementError", async () => {
    const seedDebts: FakeDebtRow[] = [
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
    const { db } = createFakeDb({ accounts: [CASH, RECEIVABLE_DEBT], debtAccounts: DEBT_ACCOUNTS, debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: false };

    await expect(
      applyDebtTransactionEdit({
        db,
        ...BASE_INPUT,
        amount: 75000,
        settleDebtIds: ["debt-row-5"],
        status,
        dangerousFieldsChanged: true,
      })
    ).rejects.toThrow(DebtSelfSettlementError);
  });

  it("role 'payment', field berbahaya TIDAK berubah: cuma sinkronkan date", async () => {
    const seedDebts: FakeDebtRow[] = [
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
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debtPayments } = createFakeDb({
      accounts: [CASH, RECEIVABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-8", debtId: "debt-row-5" };

    await applyDebtTransactionEdit({ db, ...BASE_INPUT, date: "2026-02-20", status, dangerousFieldsChanged: false });

    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].date).toBe("2026-02-20");
    expect(debtPayments[0].amount).toBe(20000);
  });

  it("role 'payment', field berbahaya berubah: recreate aman, debt induk tetap ongoing kalau masih ada sisa", async () => {
    const seedDebts: FakeDebtRow[] = [
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
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH, RECEIVABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-8", debtId: "debt-row-5" };

    await applyDebtTransactionEdit({
      db,
      ...BASE_INPUT,
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

  it("role 'payment', field berbahaya berubah, pembayaran BARU melunasi penuh: debt induk jadi paid", async () => {
    const seedDebts: FakeDebtRow[] = [
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
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts } = createFakeDb({
      accounts: [CASH, RECEIVABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-8", debtId: "debt-row-5" };

    await applyDebtTransactionEdit({
      db,
      ...BASE_INPUT,
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
