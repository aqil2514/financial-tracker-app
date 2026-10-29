import { describe, expect, it } from "vitest";
import { detachDebtForDeletedTransaction } from "./detach-debt-for-deleted-transaction";
import { createFakeDb, type FakeDebtRow, type FakeDebtPaymentRow } from "./create-fake-db";

describe("detachDebtForDeletedTransaction", () => {
  it("role 'none': no-op, tidak menyentuh apa pun", async () => {
    const { db, debts, debtPayments } = createFakeDb();

    const result = await detachDebtForDeletedTransaction(db, "tx-biasa");

    expect(result).toEqual({ role: "none" });
    expect(debts).toHaveLength(0);
    expect(debtPayments).toHaveLength(0);
  });

  it("role 'principal', belum dicicil: transaction_id SET NULL, debt tetap utuh (TIDAK dihapus)", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ debts: seedDebts });

    const result = await detachDebtForDeletedTransaction(db, "tx-42");

    expect(result).toEqual({ role: "principal", debtId: "debt-row-5", hadPayments: false });
    expect(debts).toHaveLength(1);
    expect(debts[0].transaction_id).toBeNull();
    expect(debts[0].amount).toBe(50000);
    expect(debts[0].status).toBe("ongoing");
  });

  it("role 'principal', SUDAH dicicil dari transaksi lain: transaction_id SET NULL, cicilan TIDAK tersentuh", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-1", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-999", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({ debts: seedDebts, debtPayments: seedPayments });

    const result = await detachDebtForDeletedTransaction(db, "tx-42");

    expect(result).toEqual({ role: "principal", debtId: "debt-row-5", hadPayments: true });
    expect(debts[0].transaction_id).toBeNull();
    expect(debts[0].amount).toBe(50000);
    expect(debtPayments).toHaveLength(1);
    expect(debtPayments[0].id).toBe("payment-1");
    expect(debtPayments[0].transaction_id).toBe("tx-999");
  });

  it("role 'payment', debt BELUM lunas: hapus debt_payments ini saja, status tidak berubah", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 20000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({ debts: seedDebts, debtPayments: seedPayments });

    const result = await detachDebtForDeletedTransaction(db, "tx-42");

    expect(result).toEqual({ role: "payment", debtId: "debt-row-5" });
    expect(debtPayments).toHaveLength(0);
    expect(debts[0].status).toBe("ongoing");
    expect(debts[0].amount).toBe(50000);
  });

  it("role 'payment', menghapus cicilan yang MELUNASI penuh: debt direvert dari 'paid' ke 'ongoing'", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "paid",
        date: "2026-01-01",
      },
    ];
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 50000, account_id: "cash-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({ debts: seedDebts, debtPayments: seedPayments });

    const result = await detachDebtForDeletedTransaction(db, "tx-42");

    expect(result).toEqual({ role: "payment", debtId: "debt-row-5" });
    expect(debtPayments).toHaveLength(0);
    expect(debts[0].status).toBe("ongoing");
  });

  it("role 'payment', menghapus transaksi PENUTUP write-off: debt direvert dari 'written_off' ke 'ongoing' (bukan nyangkut 'Dihapuskan' dengan remaining > 0)", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-5",
        type: "receivable",
        contact_id: "contact-10",
        amount: 50000,
        account_id: "debt-1",
        transaction_id: "tx-999",
        status: "written_off",
        date: "2026-01-01",
      },
    ];
    const seedPayments: FakeDebtPaymentRow[] = [
      { id: "payment-8", debt_id: "debt-row-5", amount: 50000, account_id: "debt-1", transaction_id: "tx-42", date: "2026-02-01" },
    ];
    const { db, debts, debtPayments } = createFakeDb({ debts: seedDebts, debtPayments: seedPayments });

    const result = await detachDebtForDeletedTransaction(db, "tx-42");

    expect(result).toEqual({ role: "payment", debtId: "debt-row-5" });
    expect(debtPayments).toHaveLength(0);
    expect(debts[0].status).toBe("ongoing");
  });
});
