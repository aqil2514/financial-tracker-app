import { describe, expect, it } from "vitest";
import { getDebtPayments } from "./debt-payments";
import { createContactsFakeDb, type FakeDebtPaymentRow } from "./contacts-create-fake-db";

describe("getDebtPayments", () => {
  it("debt tanpa cicilan: hasil kosong", async () => {
    const { db } = createContactsFakeDb();
    const result = await getDebtPayments(db, "debt-1");
    expect(result).toEqual([]);
  });

  it("mengembalikan semua cicilan milik satu debt, diurut tanggal terbaru dulu", async () => {
    const debtPayments: FakeDebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-1", amount: 10000, account_id: "cash-1", account_name: "Dompet", transaction_id: "tx-1", date: "2026-01-01" },
      { id: "payment-2", debt_id: "debt-1", amount: 15000, account_id: "cash-1", account_name: "Dompet", transaction_id: "tx-2", date: "2026-02-01" },
    ];
    const { db } = createContactsFakeDb({ debtPayments });

    const result = await getDebtPayments(db, "debt-1");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("payment-2");
    expect(result[0].account_name).toBe("Dompet");
  });

  it("cicilan milik debt lain tidak ikut tercampur", async () => {
    const debtPayments: FakeDebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-1", amount: 10000, account_id: "cash-1", transaction_id: "tx-1", date: "2026-01-01" },
      { id: "payment-2", debt_id: "debt-2", amount: 20000, account_id: "cash-1", transaction_id: "tx-2", date: "2026-01-02" },
    ];
    const { db } = createContactsFakeDb({ debtPayments });

    const result = await getDebtPayments(db, "debt-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("payment-1");
  });
});
