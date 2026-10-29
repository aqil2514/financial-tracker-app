import { describe, expect, it } from "vitest";
import { applyDirectDebtTransaction } from "./apply-direct-debt-transaction";
import { createFakeDb, type FakeAccountRow, type FakeDebtAccountRow, type FakeDebtRow } from "./create-fake-db";

const PAYABLE_DEBT: FakeAccountRow = { id: "debt-1", account_type: "debt", name: "Utang Toko" };
const RECEIVABLE_DEBT: FakeAccountRow = { id: "debt-2", account_type: "debt", name: "Piutang Budi" };

const DEBT_ACCOUNTS: FakeDebtAccountRow[] = [
  { account_id: "debt-1", direction: "payable" },
  { account_id: "debt-2", direction: "receivable" },
];

describe("applyDirectDebtTransaction", () => {
  it("expense di akun payable: melahirkan utang baru (bukan pelunasan)", async () => {
    const { db, debts } = createFakeDb({ accounts: [PAYABLE_DEBT], debtAccounts: DEBT_ACCOUNTS });

    const result = await applyDirectDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "expense",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 40000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(result.debtIds).toHaveLength(1);
    expect(debts[0].type).toBe("payable");
    expect(debts[0].amount).toBe(40000);
  });

  it("income di akun receivable: melahirkan piutang baru (bukan pelunasan)", async () => {
    const { db, debts } = createFakeDb({ accounts: [RECEIVABLE_DEBT], debtAccounts: DEBT_ACCOUNTS });

    const result = await applyDirectDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "income",
      accountId: "debt-2",
      contactId: "contact-10",
      amount: 25000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(result.debtIds).toHaveLength(1);
    expect(debts[0].type).toBe("receivable");
  });

  it("income di akun payable (bayar utang non-cash): melunasi (FIFO), bukan melahirkan debt baru", async () => {
    const seedDebt: FakeDebtRow = {
      id: "debt-row-1",
      type: "payable",
      contact_id: "contact-10",
      amount: 40000,
      account_id: "debt-1",
      transaction_id: "tx-0",
      status: "ongoing",
      date: "2026-01-01",
    };
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [PAYABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: [seedDebt],
    });

    const result = await applyDirectDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "income",
      accountId: "debt-1",
      contactId: "contact-10",
      amount: 40000,
      date: "2026-02-01",
      settleDebtIds: ["debt-row-1"],
    });

    expect(result.debtIds).toEqual(["debt-row-1"]);
    expect(debts[0].status).toBe("paid");
    expect(debtPayments).toHaveLength(1);
  });

  it("expense di akun receivable (piutang diterima dalam bentuk non-cash): melunasi (FIFO)", async () => {
    const seedDebt: FakeDebtRow = {
      id: "debt-row-2",
      type: "receivable",
      contact_id: "contact-10",
      amount: 25000,
      account_id: "debt-2",
      transaction_id: "tx-0",
      status: "ongoing",
      date: "2026-01-01",
    };
    const { db, debts } = createFakeDb({
      accounts: [RECEIVABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: [seedDebt],
    });

    const result = await applyDirectDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "expense",
      accountId: "debt-2",
      contactId: "contact-10",
      amount: 25000,
      date: "2026-02-01",
      settleDebtIds: ["debt-row-2"],
    });

    expect(result.debtIds).toEqual(["debt-row-2"]);
    expect(debts[0].status).toBe("paid");
  });
});
