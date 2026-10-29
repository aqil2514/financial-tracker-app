import { describe, expect, it } from "vitest";
import { getTransactionDebtStatus } from "./transaction-debt-status";
import { createFakeDb, type FakeDebtRow, type FakeDebtPaymentRow } from "./create-fake-db";

describe("getTransactionDebtStatus", () => {
  it("transaksi tidak terkait debt sama sekali: role 'none'", async () => {
    const { db } = createFakeDb();
    const status = await getTransactionDebtStatus(db, "tx-biasa");
    expect(status).toEqual({ role: "none" });
  });

  it("transaksi adalah pokok debt, belum ada cicilan: role 'principal', hasPayments false", async () => {
    const debt: FakeDebtRow = {
      id: "debt-1",
      type: "receivable",
      contact_id: "contact-1",
      amount: 50000,
      account_id: "debt-acc-1",
      transaction_id: "tx-42",
      status: "ongoing",
      date: "2026-01-01",
    };
    const { db } = createFakeDb({ debts: [debt] });
    const status = await getTransactionDebtStatus(db, "tx-42");
    expect(status).toEqual({ role: "principal", debtId: "debt-1", hasPayments: false });
  });

  it("transaksi adalah pokok debt, SUDAH ada cicilan: role 'principal', hasPayments true", async () => {
    const debt: FakeDebtRow = {
      id: "debt-1",
      type: "receivable",
      contact_id: "contact-1",
      amount: 50000,
      account_id: "debt-acc-1",
      transaction_id: "tx-42",
      status: "ongoing",
      date: "2026-01-01",
    };
    const payment: FakeDebtPaymentRow = {
      id: "payment-1",
      debt_id: "debt-1",
      amount: 20000,
      account_id: "cash-1",
      transaction_id: "tx-999",
      date: "2026-02-01",
    };
    const { db } = createFakeDb({ debts: [debt], debtPayments: [payment] });
    const status = await getTransactionDebtStatus(db, "tx-42");
    expect(status).toEqual({ role: "principal", debtId: "debt-1", hasPayments: true });
  });

  it("transaksi adalah satu cicilan: role 'payment'", async () => {
    const debt: FakeDebtRow = {
      id: "debt-1",
      type: "receivable",
      contact_id: "contact-1",
      amount: 50000,
      account_id: "debt-acc-1",
      transaction_id: "tx-999",
      status: "ongoing",
      date: "2026-01-01",
    };
    const payment: FakeDebtPaymentRow = {
      id: "payment-1",
      debt_id: "debt-1",
      amount: 20000,
      account_id: "cash-1",
      transaction_id: "tx-42",
      date: "2026-02-01",
    };
    const { db } = createFakeDb({ debts: [debt], debtPayments: [payment] });
    const status = await getTransactionDebtStatus(db, "tx-42");
    expect(status).toEqual({ role: "payment", debtPaymentId: "payment-1", debtId: "debt-1" });
  });
});
