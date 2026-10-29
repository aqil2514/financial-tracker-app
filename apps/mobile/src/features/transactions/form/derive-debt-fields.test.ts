import { describe, expect, it } from "vitest";
import { deriveDebtFields, validateDebtFields, type OngoingDebt } from "./derive-debt-fields";

const CASH: { accountType: "cash"; direction: null } = { accountType: "cash", direction: null };
const RECEIVABLE: { accountType: "debt"; direction: "receivable" } = {
  accountType: "debt",
  direction: "receivable",
};
const PAYABLE: { accountType: "debt"; direction: "payable" } = { accountType: "debt", direction: "payable" };

describe("deriveDebtFields", () => {
  it("info akun belum termuat (null): involvesDebtAccount false, tidak error", () => {
    const result = deriveDebtFields("expense", null, null);
    expect(result.involvesDebtAccount).toBe(false);
    expect(result.needsDebtAction).toBe(false);
    expect(result.unsupportedPairMessage).toBeNull();
  });

  it("expense di akun cash: tidak melibatkan debt", () => {
    const result = deriveDebtFields("expense", CASH, null);
    expect(result.involvesDebtAccount).toBe(false);
  });

  it("expense di akun receivable: melibatkan debt, settlementDirection receivable (pelunasan)", () => {
    const result = deriveDebtFields("expense", RECEIVABLE, null);
    expect(result.involvesDebtAccount).toBe(true);
    expect(result.settlementDirection).toBe("receivable");
    expect(result.needsDebtAction).toBe(true);
  });

  it("income di akun payable: melibatkan debt, settlementDirection payable (bayar non-cash)", () => {
    const result = deriveDebtFields("income", PAYABLE, null);
    expect(result.settlementDirection).toBe("payable");
  });

  it("income di akun receivable: melahirkan piutang baru, bukan pelunasan (settlementDirection null)", () => {
    const result = deriveDebtFields("income", RECEIVABLE, null);
    expect(result.involvesDebtAccount).toBe(true);
    expect(result.settlementDirection).toBeNull();
    expect(result.needsDebtAction).toBe(false);
  });

  it("transfer cash-cash: tidak melibatkan debt", () => {
    const result = deriveDebtFields("transfer", CASH, CASH);
    expect(result.involvesDebtAccount).toBe(false);
  });

  it("transfer debt-debt: tidak melibatkan debt (no-op di logic, bukan error)", () => {
    const result = deriveDebtFields("transfer", RECEIVABLE, PAYABLE);
    expect(result.involvesDebtAccount).toBe(false);
    expect(result.isDebtDebtTransfer).toBe(true);
  });

  it("transfer cash->debt direction receivable: melahirkan piutang baru (settlementDirection null)", () => {
    const result = deriveDebtFields("transfer", CASH, RECEIVABLE);
    expect(result.involvesDebtAccount).toBe(true);
    expect(result.settlementDirection).toBeNull();
  });

  it("transfer cash->debt direction payable: melunasi utang (settlementDirection payable)", () => {
    const result = deriveDebtFields("transfer", CASH, PAYABLE);
    expect(result.settlementDirection).toBe("payable");
  });

  it("transfer debt->cash direction receivable: melunasi piutang (settlementDirection receivable)", () => {
    const result = deriveDebtFields("transfer", RECEIVABLE, CASH);
    expect(result.settlementDirection).toBe("receivable");
  });

  it("transfer debt->cash direction payable: melahirkan utang baru (settlementDirection null)", () => {
    const result = deriveDebtFields("transfer", PAYABLE, CASH);
    expect(result.settlementDirection).toBeNull();
  });
});

describe("validateDebtFields", () => {
  const notInvolved = deriveDebtFields("expense", CASH, null);
  const needsContact = deriveDebtFields("expense", RECEIVABLE, null);

  it("tidak melibatkan debt: selalu lolos", () => {
    const error = validateDebtFields(notInvolved, [], { amount: 10000, contact_id: null, settle_debt_ids: [] });
    expect(error).toBeNull();
  });

  it("melibatkan debt tapi contact_id kosong: ditolak", () => {
    const error = validateDebtFields(needsContact, [], { amount: 10000, contact_id: null, settle_debt_ids: [] });
    expect(error).toMatch(/Kontak wajib diisi/);
  });

  it("needsDebtAction true tapi settle_debt_ids kosong: ditolak", () => {
    const error = validateDebtFields(needsContact, [], {
      amount: 10000,
      contact_id: "contact-1",
      settle_debt_ids: [],
    });
    expect(error).toMatch(/Pilih minimal satu/);
  });

  it("amount melebihi total remaining debts yang dipilih: ditolak", () => {
    const ongoingDebts: OngoingDebt[] = [{ id: "debt-1", amount: 20000, date: "2026-01-01", remaining: 20000 }];
    const error = validateDebtFields(needsContact, ongoingDebts, {
      amount: 30000,
      contact_id: "contact-1",
      settle_debt_ids: ["debt-1"],
    });
    expect(error).toMatch(/melebihi total sisa/);
  });

  it("amount pas dengan total remaining debts yang dipilih: lolos", () => {
    const ongoingDebts: OngoingDebt[] = [{ id: "debt-1", amount: 20000, date: "2026-01-01", remaining: 20000 }];
    const error = validateDebtFields(needsContact, ongoingDebts, {
      amount: 20000,
      contact_id: "contact-1",
      settle_debt_ids: ["debt-1"],
    });
    expect(error).toBeNull();
  });

  it("unsupportedPairMessage ada: ditolak duluan sebelum validasi lain", () => {
    const derived = { ...needsContact, unsupportedPairMessage: "Kombinasi tidak didukung" };
    const error = validateDebtFields(derived, [], { amount: 10000, contact_id: null, settle_debt_ids: [] });
    expect(error).toBe("Kombinasi tidak didukung");
  });
});
