import { describe, expect, it } from "vitest";
import { derivePurchase } from "./derive-purchase";
import { purchaseFormSchema, type PurchaseFormOutput } from "./schema";
import { emptyPurchaseValues } from "./values";

function parse(overrides: Record<string, unknown>) {
  return purchaseFormSchema.safeParse({ ...emptyPurchaseValues(), note: "Beli", ...overrides });
}

function issuePaths(result: ReturnType<typeof parse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("purchaseFormSchema", () => {
  it("kas + pending: unit/harga boleh kosong, akun kas dan nominal wajib", () => {
    expect(issuePaths(parse({}))).toEqual(expect.arrayContaining(["cash_account_id", "amount"]));
    expect(parse({ cash_account_id: "cash-1", amount: 500_000 }).success).toBe(true);
  });

  it("kas + settled: unit dan harga wajib", () => {
    const paths = issuePaths(parse({ cash_account_id: "cash-1", amount: 500_000, status: "settled" }));
    expect(paths).toEqual(expect.arrayContaining(["unit", "price_input"]));
  });

  it("direct: nominal boleh 0 dan tanpa akun kas, tapi unit dan harga wajib", () => {
    expect(issuePaths(parse({ source: "direct", amount: 0 }))).toEqual(
      expect.arrayContaining(["unit", "price_input"])
    );
    expect(parse({ source: "direct", amount: 0, unit: "100", price_input: "9000" }).success).toBe(true);
  });

  it("mode total tanpa unit: ditolak di price_input", () => {
    const paths = issuePaths(parse({ cash_account_id: "cash-1", amount: 1, price_mode: "total", price_input: "1000" }));
    expect(paths).toContain("price_input");
  });

  it("unit dan harga nol/negatif ditolak", () => {
    expect(issuePaths(parse({ cash_account_id: "cash-1", amount: 1, unit: "0" }))).toContain("unit");
    expect(issuePaths(parse({ cash_account_id: "cash-1", amount: 1, price_input: "-5" }))).toContain("price_input");
  });
});

describe("derivePurchase", () => {
  const base = {
    source: "cash",
    cash_account_id: "cash-1",
    amount: 1_000_000,
    unit: 4,
    price_mode: "unit",
    price_input: 250_000,
    date: "2026-11-01",
    note: "Beli",
    status: "pending",
  } as PurchaseFormOutput;

  it("mode satuan: harga dipakai apa adanya", () => {
    expect(derivePurchase(base).pricePerUnit).toBe(250_000);
  });

  it("mode total: harga dibagi unit", () => {
    expect(derivePurchase({ ...base, price_mode: "total", price_input: 1_000_000 }).pricePerUnit).toBe(250_000);
  });

  it("harga kosong: null", () => {
    expect(derivePurchase({ ...base, price_input: null }).pricePerUnit).toBeNull();
  });

  it("direct: status dipaksa settled dan akun kas dibuang", () => {
    const result = derivePurchase({ ...base, source: "direct", status: "pending" });
    expect(result.status).toBe("settled");
    expect(result.cashAccountId).toBeNull();
  });
});
