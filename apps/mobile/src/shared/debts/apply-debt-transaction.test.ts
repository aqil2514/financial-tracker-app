import { describe, expect, it } from "vitest";
import { applyDebtTransaction } from "./apply-debt-transaction";
import { DebtAccountDirectionMissingError } from "./create-debt";
import { createFakeDb, type FakeAccountRow, type FakeDebtAccountRow } from "./create-fake-db";

const CASH: FakeAccountRow = { id: "cash-1", account_type: "cash" };
const RECEIVABLE_DEBT: FakeAccountRow = { id: "debt-1", account_type: "debt", name: "Piutang Budi" };
const PAYABLE_DEBT: FakeAccountRow = { id: "debt-2", account_type: "debt", name: "Utang Toko" };
const NO_DIRECTION_DEBT: FakeAccountRow = { id: "debt-3", account_type: "debt", name: "Belum Diisi" };

const DEBT_ACCOUNTS: FakeDebtAccountRow[] = [
  { account_id: "debt-1", direction: "receivable" },
  { account_id: "debt-2", direction: "payable" },
];

describe("applyDebtTransaction", () => {
  it("bukan transfer: no-op", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH, RECEIVABLE_DEBT], debtAccounts: DEBT_ACCOUNTS });

    const result = await applyDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "income",
      accountId: "cash-1",
      transferAccountId: null,
      contactId: null,
      amount: 10000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(result).toEqual({ debtIds: [], debtPaymentIds: [] });
    expect(debts).toHaveLength(0);
  });

  it("cash-cash: no-op", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH, { id: "cash-2", account_type: "cash" }] });

    const result = await applyDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "cash-2",
      contactId: null,
      amount: 10000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(result).toEqual({ debtIds: [], debtPaymentIds: [] });
    expect(debts).toHaveLength(0);
  });

  it("debt-debt: no-op", async () => {
    const { db, debts } = createFakeDb({
      accounts: [RECEIVABLE_DEBT, PAYABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
    });

    const result = await applyDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "debt-1",
      transferAccountId: "debt-2",
      contactId: null,
      amount: 10000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(result).toEqual({ debtIds: [], debtPaymentIds: [] });
    expect(debts).toHaveLength(0);
  });

  it("cash->debt, direction receivable: melahirkan piutang baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH, RECEIVABLE_DEBT], debtAccounts: DEBT_ACCOUNTS });

    const result = await applyDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "debt-1",
      contactId: "contact-10",
      amount: 50000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(result.debtIds).toHaveLength(1);
    expect(debts).toHaveLength(1);
    expect(debts[0].type).toBe("receivable");
    expect(debts[0].amount).toBe(50000);
    expect(debts[0].account_id).toBe("debt-1");
    expect(debts[0].transaction_id).toBe("tx-1");
  });

  it("cash->debt, direction payable: melunasi (FIFO) bukan melahirkan debt baru", async () => {
    const { db, debts, debtPayments } = createFakeDb({
      accounts: [CASH, PAYABLE_DEBT],
      debtAccounts: DEBT_ACCOUNTS,
      debts: [
        {
          id: "debt-row-1",
          type: "payable",
          contact_id: "contact-10",
          amount: 50000,
          account_id: "debt-2",
          transaction_id: "tx-0",
          status: "ongoing",
          date: "2026-01-01",
        },
      ],
    });

    const result = await applyDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "cash-1",
      transferAccountId: "debt-2",
      contactId: "contact-10",
      amount: 50000,
      date: "2026-02-01",
      settleDebtIds: ["debt-row-1"],
    });

    expect(result.debtIds).toEqual(["debt-row-1"]);
    expect(debts[0].status).toBe("paid");
    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].amount).toBe(50000);
  });

  it("debt->cash, direction payable (utang dilahirkan dari sisi akun debt): melahirkan debt baru", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH, PAYABLE_DEBT], debtAccounts: DEBT_ACCOUNTS });

    const result = await applyDebtTransaction({
      db,
      transactionId: "tx-1",
      type: "transfer",
      accountId: "debt-2",
      transferAccountId: "cash-1",
      contactId: "contact-10",
      amount: 30000,
      date: "2026-01-01",
      settleDebtIds: [],
    });

    expect(result.debtIds).toHaveLength(1);
    expect(debts[0].type).toBe("payable");
    expect(debts[0].account_id).toBe("debt-2");
  });

  it("akun debt belum punya direction: throw DebtAccountDirectionMissingError", async () => {
    const { db } = createFakeDb({ accounts: [CASH, NO_DIRECTION_DEBT], debtAccounts: DEBT_ACCOUNTS });

    await expect(
      applyDebtTransaction({
        db,
        transactionId: "tx-1",
        type: "transfer",
        accountId: "cash-1",
        transferAccountId: "debt-3",
        contactId: null,
        amount: 10000,
        date: "2026-01-01",
        settleDebtIds: [],
      })
    ).rejects.toThrow(DebtAccountDirectionMissingError);
  });
});
