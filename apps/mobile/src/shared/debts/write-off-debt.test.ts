import { describe, expect, it } from "vitest";
import { writeOffDebt } from "./write-off-debt";
import { createFakeDb, type FakeDebtRow } from "./create-fake-db";

describe("writeOffDebt", () => {
  it("remaining 0: no-op, tidak membuat transaksi/payment apa pun", async () => {
    const { db, transactions, debtPayments } = createFakeDb();

    await writeOffDebt({ db, debtId: "debt-1", type: "receivable", accountId: "debt-acc-1", remaining: 0 });

    expect(transactions).toHaveLength(0);
    expect(debtPayments).toHaveLength(0);
  });

  it("receivable: membuat transaksi expense is_cash_neutral=1, payment sebesar remaining, status jadi written_off", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "receivable",
        contact_id: "contact-1",
        amount: 50000,
        account_id: "debt-acc-1",
        transaction_id: "tx-0",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, transactions, debts, debtPayments } = createFakeDb({ debts: seedDebts });

    await writeOffDebt({ db, debtId: "debt-1", type: "receivable", accountId: "debt-acc-1", remaining: 30000 });

    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe("expense");
    expect(transactions[0].amount).toBe(30000);
    expect(transactions[0].is_cash_neutral).toBe(1);
    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].amount).toBe(30000);
    expect(debts[0].status).toBe("written_off");
  });

  it("payable: membuat transaksi income (bukan expense)", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "payable",
        contact_id: "contact-1",
        amount: 40000,
        account_id: "debt-acc-1",
        transaction_id: "tx-0",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, transactions } = createFakeDb({ debts: seedDebts });

    await writeOffDebt({ db, debtId: "debt-1", type: "payable", accountId: "debt-acc-1", remaining: 40000 });

    expect(transactions[0].type).toBe("income");
  });
});
