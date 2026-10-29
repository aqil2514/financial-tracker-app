import { describe, expect, it } from "vitest";
import {
  applyDirectDebtTransactionEdit,
  DebtEditBlockedError,
  DebtSelfSettlementError,
} from "./apply-direct-debt-transaction-edit";
import type { TransactionDebtStatus } from "./transaction-debt-status";
import { createFakeDb, type FakeAccountRow, type FakeDebtAccountRow, type FakeDebtRow, type FakeDebtPaymentRow } from "./create-fake-db";

const PAYABLE_DEBT: FakeAccountRow = { id: "debt-1", account_type: "debt" };
const DEBT_ACCOUNTS: FakeDebtAccountRow[] = [{ account_id: "debt-1", direction: "payable" }];

const BASE_INPUT = {
  transactionId: "tx-42",
  type: "expense" as const,
  accountId: "debt-1",
  contactId: "contact-10",
  amount: 40000,
  date: "2026-03-01",
  settleDebtIds: [] as string[],
};

describe("applyDirectDebtTransactionEdit", () => {
  it("role 'none': berperilaku sama seperti create baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [PAYABLE_DEBT], debtAccounts: DEBT_ACCOUNTS });
    const status: TransactionDebtStatus = { role: "none" };

    await applyDirectDebtTransactionEdit({ db, ...BASE_INPUT, status, dangerousFieldsChanged: false });

    expect(debts).toHaveLength(1);
    expect(debts[0].type).toBe("payable");
  });

  it("role 'principal', field berbahaya berubah, SUDAH ada cicilan: DIBLOKIR", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-5",
        type: "payable",
        contact_id: "contact-10",
        amount: 40000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-row-5", amount: 10000, account_id: "cash-1", transaction_id: "tx-999", date: "2026-02-01" },
    ];
    const { db } = createFakeDb({
      accounts: [PAYABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: true };

    await expect(
      applyDirectDebtTransactionEdit({ db, ...BASE_INPUT, amount: 60000, status, dangerousFieldsChanged: true })
    ).rejects.toThrow(DebtEditBlockedError);
  });

  it("role 'principal', mencoba melunasi debt miliknya sendiri: DebtSelfSettlementError", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-5",
        type: "payable",
        contact_id: "contact-10",
        amount: 40000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db } = createFakeDb({ accounts: [PAYABLE_DEBT], debtAccounts: DEBT_ACCOUNTS, debts: seedDebts });
    const status: TransactionDebtStatus = { role: "principal", debtId: "debt-row-5", hasPayments: false };

    await expect(
      applyDirectDebtTransactionEdit({
        db,
        ...BASE_INPUT,
        amount: 60000,
        settleDebtIds: ["debt-row-5"],
        status,
        dangerousFieldsChanged: true,
      })
    ).rejects.toThrow(DebtSelfSettlementError);
  });

  it("role 'payment', field berbahaya berubah: recreate, hapus payment lama", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-5",
        type: "payable",
        contact_id: "contact-10",
        amount: 40000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 15000, account_id: "debt-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debtPayments } = createFakeDb({
      accounts: [PAYABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: seedDebts,
      debtPayments: seedPayments,
    });
    const status: TransactionDebtStatus = { role: "payment", debtPaymentId: "payment-8", debtId: "debt-row-5" };

    await applyDirectDebtTransactionEdit({
      db,
      ...BASE_INPUT,
      type: "income",
      amount: 20000,
      settleDebtIds: ["debt-row-5"],
      status,
      dangerousFieldsChanged: true,
    });

    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].id).not.toBe("payment-8");
    expect(debtPayments[0].amount).toBe(20000);
  });
});
