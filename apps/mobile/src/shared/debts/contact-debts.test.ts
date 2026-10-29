import { describe, expect, it } from "vitest";
import { getContactDebts } from "./contact-debts";
import { createContactsFakeDb, type FakeContactRow, type FakeDebtRow } from "./contacts-create-fake-db";

describe("getContactDebts", () => {
  it("kontak tanpa debts: hasil kosong", async () => {
    const { db } = createContactsFakeDb();
    const result = await getContactDebts(db, "contact-1");
    expect(result).toEqual([]);
  });

  it("mengembalikan SEMUA status (ongoing/paid/written_off), bukan cuma ongoing", async () => {
    const contacts: FakeContactRow[] = [{ id: "contact-1", name: "Budi" }];
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "receivable",
        contact_id: "contact-1",
        amount: 10000,
        account_id: "acc-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-01-01",
      },
      {
        id: "debt-2",
        type: "receivable",
        contact_id: "contact-1",
        amount: 20000,
        account_id: "acc-1",
        transaction_id: "tx-2",
        status: "paid",
        date: "2026-01-02",
      },
      {
        id: "debt-3",
        type: "payable",
        contact_id: "contact-1",
        amount: 5000,
        account_id: "acc-1",
        transaction_id: "tx-3",
        status: "written_off",
        date: "2026-01-03",
      },
    ];
    const { db } = createContactsFakeDb({ contacts, debts });

    const result = await getContactDebts(db, "contact-1");

    expect(result).toHaveLength(3);
    expect(result.map((d) => d.status).sort()).toEqual(["ongoing", "paid", "written_off"]);
  });

  it("debt milik kontak lain tidak ikut tercampur", async () => {
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "receivable",
        contact_id: "contact-1",
        amount: 10000,
        account_id: "acc-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-01-01",
      },
      {
        id: "debt-2",
        type: "receivable",
        contact_id: "contact-2",
        amount: 20000,
        account_id: "acc-1",
        transaction_id: "tx-2",
        status: "ongoing",
        date: "2026-01-02",
      },
    ];
    const { db } = createContactsFakeDb({ debts });

    const result = await getContactDebts(db, "contact-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("debt-1");
  });

  it("remaining dihitung dari amount dikurangi total cicilan", async () => {
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "payable",
        contact_id: "contact-1",
        amount: 30000,
        account_id: "acc-1",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db } = createContactsFakeDb({
      debts,
      debtPayments: [{ id: "payment-1", debt_id: "debt-1", amount: 10000, account_id: "cash-1", transaction_id: "tx-2", date: "2026-02-01" }],
    });

    const result = await getContactDebts(db, "contact-1");

    expect(result[0].remaining).toBe(20000);
  });
});
