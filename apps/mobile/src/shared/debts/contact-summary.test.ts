import { describe, expect, it } from "vitest";
import { getContactSummary } from "./contact-summary";
import { createContactsFakeDb, type FakeContactRow, type FakeDebtRow, type FakeDebtPaymentRow } from "./contacts-create-fake-db";

describe("getContactSummary", () => {
  it("kontak tanpa debts sama sekali: tidak muncul di hasil", async () => {
    const contacts: FakeContactRow[] = [{ id: "contact-1", name: "Budi" }];
    const { db } = createContactsFakeDb({ contacts });

    const result = await getContactSummary(db);

    expect(result).toHaveLength(0);
  });

  it("kontak dengan piutang ongoing: receivable_active/remaining terhitung, payable 0", async () => {
    const contacts: FakeContactRow[] = [{ id: "contact-1", name: "Budi" }];
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "receivable",
        contact_id: "contact-1",
        amount: 50000,
        account_id: "debt-acc-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db } = createContactsFakeDb({ contacts, debts });

    const result = await getContactSummary(db);

    expect(result).toHaveLength(1);
    expect(result[0].receivable_active).toBe(50000);
    expect(result[0].receivable_paid).toBe(0);
    expect(result[0].receivable_remaining).toBe(50000);
    expect(result[0].payable_active).toBe(0);
  });

  it("debt yang sudah dicicil sebagian: paid dan remaining terhitung benar", async () => {
    const contacts: FakeContactRow[] = [{ id: "contact-1", name: "Budi" }];
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "payable",
        contact_id: "contact-1",
        amount: 40000,
        account_id: "debt-acc-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const debtPayments: FakeDebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-1", amount: 15000, account_id: "cash-1", transaction_id: "tx-2", date: "2026-02-01" },
    ];
    const { db } = createContactsFakeDb({ contacts, debts, debtPayments });

    const result = await getContactSummary(db);

    expect(result[0].payable_active).toBe(40000);
    expect(result[0].payable_paid).toBe(15000);
    expect(result[0].payable_remaining).toBe(25000);
  });

  it("debt dengan status 'paid' (sudah lunas): TIDAK ikut dihitung di active/remaining", async () => {
    const contacts: FakeContactRow[] = [{ id: "contact-1", name: "Budi" }];
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "receivable",
        contact_id: "contact-1",
        amount: 30000,
        account_id: "debt-acc-1",
        transaction_id: "tx-1",
        status: "paid",
        date: "2026-01-01",
      },
    ];
    const { db } = createContactsFakeDb({ contacts, debts });

    const result = await getContactSummary(db);

    expect(result).toHaveLength(1);
    expect(result[0].receivable_active).toBe(0);
    expect(result[0].receivable_remaining).toBe(0);
  });

  it("kontak dengan piutang DAN utang sekaligus: keduanya terhitung independen", async () => {
    const contacts: FakeContactRow[] = [{ id: "contact-1", name: "Budi" }];
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "receivable",
        contact_id: "contact-1",
        amount: 20000,
        account_id: "debt-acc-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-01-01",
      },
      {
        id: "debt-2",
        type: "payable",
        contact_id: "contact-1",
        amount: 10000,
        account_id: "debt-acc-1",
        transaction_id: "tx-2",
        status: "ongoing",
        date: "2026-01-02",
      },
    ];
    const { db } = createContactsFakeDb({ contacts, debts });

    const result = await getContactSummary(db);

    expect(result[0].receivable_active).toBe(20000);
    expect(result[0].payable_active).toBe(10000);
  });
});
