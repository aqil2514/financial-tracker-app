import { describe, expect, it } from "vitest";
import { settleDebtsFifo } from "./settle-debts-fifo";
import { createFakeDb, type FakeDebtRow } from "./create-fake-db";

const DEBT_1: FakeDebtRow = {
  id: "debt-1",
  type: "payable",
  contact_id: "contact-1",
  amount: 30000,
  account_id: "debt-acc-1",
  transaction_id: "tx-0",
  status: "ongoing",
  date: "2026-01-01",
};
const DEBT_2: FakeDebtRow = {
  id: "debt-2",
  type: "payable",
  contact_id: "contact-1",
  amount: 20000,
  account_id: "debt-acc-1",
  transaction_id: "tx-0",
  status: "ongoing",
  date: "2026-01-05",
};

describe("settleDebtsFifo", () => {
  it("settleDebtIds kosong: no-op", async () => {
    const { db, debtPayments } = createFakeDb({ debts: [DEBT_1, DEBT_2] });

    const result = await settleDebtsFifo({
      db,
      transactionId: "tx-1",
      accountId: "debt-acc-1",
      amount: 10000,
      date: "2026-02-01",
      settleDebtIds: [],
    });

    expect(result).toEqual({ debtIds: [], debtPaymentIds: [] });
    expect(debtPayments).toHaveLength(0);
  });

  it("pembayaran pas melunasi satu debt tertua (FIFO), debt lain tidak tersentuh", async () => {
    const { db, debts, debtPayments } = createFakeDb({ debts: [DEBT_1, DEBT_2] });

    const result = await settleDebtsFifo({
      db,
      transactionId: "tx-1",
      accountId: "debt-acc-1",
      amount: 30000,
      date: "2026-02-01",
      settleDebtIds: ["debt-1", "debt-2"],
    });

    expect(result.debtIds).toEqual(["debt-1"]);
    expect(debts.find((d) => d.id === "debt-1")?.status).toBe("paid");
    expect(debts.find((d) => d.id === "debt-2")?.status).toBe("ongoing");
    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].amount).toBe(30000);
  });

  it("pembayaran melebihi debt tertua: lunasi debt-1 penuh, sisanya alokasi ke debt-2 (satu baris payment per debt)", async () => {
    const { db, debts, debtPayments } = createFakeDb({ debts: [DEBT_1, DEBT_2] });

    const result = await settleDebtsFifo({
      db,
      transactionId: "tx-1",
      accountId: "debt-acc-1",
      amount: 40000,
      date: "2026-02-01",
      settleDebtIds: ["debt-1", "debt-2"],
    });

    expect(result.debtIds).toEqual(["debt-1"]);
    expect(debts.find((d) => d.id === "debt-1")?.status).toBe("paid");
    expect(debts.find((d) => d.id === "debt-2")?.status).toBe("ongoing");
    expect(debtPayments).toHaveLength(2);
    expect(debtPayments.find((p) => p.debt_id === "debt-1")?.amount).toBe(30000);
    expect(debtPayments.find((p) => p.debt_id === "debt-2")?.amount).toBe(10000);
  });

  it("pembayaran melebihi total remaining semua debt yang dipilih: sisa diabaikan (validasi jumlah ada di level form, bukan di sini)", async () => {
    const { db, debts, debtPayments } = createFakeDb({ debts: [DEBT_1, DEBT_2] });

    await settleDebtsFifo({
      db,
      transactionId: "tx-1",
      accountId: "debt-acc-1",
      amount: 999999,
      date: "2026-02-01",
      settleDebtIds: ["debt-1", "debt-2"],
    });

    expect(debts.find((d) => d.id === "debt-1")?.status).toBe("paid");
    expect(debts.find((d) => d.id === "debt-2")?.status).toBe("paid");
    expect(debtPayments.find((p) => p.debt_id === "debt-1")?.amount).toBe(30000);
    expect(debtPayments.find((p) => p.debt_id === "debt-2")?.amount).toBe(20000);
  });

  it("debt yang sudah ada cicilan sebagian: remaining dihitung dari sisa, bukan amount penuh", async () => {
    const { db, debts, debtPayments } = createFakeDb({
      debts: [DEBT_1],
      debtPayments: [
        { id: "payment-0", debt_id: "debt-1", amount: 10000, account_id: "debt-acc-1", transaction_id: "tx-0", date: "2026-01-10" },
      ],
    });

    await settleDebtsFifo({
      db,
      transactionId: "tx-1",
      accountId: "debt-acc-1",
      amount: 20000,
      date: "2026-02-01",
      settleDebtIds: ["debt-1"],
    });

    expect(debts[0].status).toBe("paid");
    expect(debtPayments).toHaveLength(2);
  });
});
