import { describe, expect, it } from "vitest";
import { getDebtsList } from "./debts-list";
import { createContactsFakeDb, type FakeContactRow, type FakeDebtRow } from "./contacts-create-fake-db";

describe("getDebtsList", () => {
  it("tidak ada debts sama sekali: hasil kosong", async () => {
    const { db } = createContactsFakeDb();
    const result = await getDebtsList(db);
    expect(result).toEqual([]);
  });

  it("mencampur payable dan receivable dalam satu list flat", async () => {
    const contacts: FakeContactRow[] = [{ id: "contact-1", name: "Budi" }];
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "receivable",
        contact_id: "contact-1",
        amount: 10000,
        account_id: "acc-1",
        account_name: "Piutang Budi",
        transaction_id: "tx-1",
        status: "ongoing",
        date: "2026-01-01",
      },
      {
        id: "debt-2",
        type: "payable",
        contact_id: "contact-1",
        amount: 20000,
        account_id: "acc-2",
        account_name: "Utang Toko",
        transaction_id: "tx-2",
        status: "ongoing",
        date: "2026-01-02",
      },
    ];
    const { db } = createContactsFakeDb({ contacts, debts });

    const result = await getDebtsList(db);

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.type).sort()).toEqual(["payable", "receivable"]);
  });

  it("mengembalikan SEMUA status, diurut tanggal terbaru dulu", async () => {
    const debts: FakeDebtRow[] = [
      {
        id: "debt-1",
        type: "receivable",
        contact_id: "contact-1",
        amount: 10000,
        account_id: "acc-1",
        transaction_id: "tx-1",
        status: "paid",
        date: "2026-01-01",
      },
      {
        id: "debt-2",
        type: "receivable",
        contact_id: "contact-1",
        amount: 20000,
        account_id: "acc-1",
        transaction_id: "tx-2",
        status: "ongoing",
        date: "2026-01-05",
      },
    ];
    const { db } = createContactsFakeDb({ debts });

    const result = await getDebtsList(db);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("debt-2");
    expect(result[1].id).toBe("debt-1");
  });
});
