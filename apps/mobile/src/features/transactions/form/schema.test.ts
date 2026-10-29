import { describe, expect, it } from "vitest";
import { transactionSchema } from "./schema";

const BASE = {
  type: "expense" as const,
  amount: 10000,
  account_id: "acc-1",
  category_id: "cat-1",
  transfer_account_id: null,
  note: "Makan siang",
  description: null,
  date: "2026-01-01",
};

describe("transactionSchema", () => {
  it("menerima income/expense tanpa transfer_account_id", () => {
    const result = transactionSchema.safeParse(BASE);
    expect(result.success).toBe(true);
  });

  it("menolak amount negatif", () => {
    const result = transactionSchema.safeParse({ ...BASE, amount: -1000 });
    expect(result.success).toBe(false);
  });

  it("menolak note kosong", () => {
    const result = transactionSchema.safeParse({ ...BASE, note: "" });
    expect(result.success).toBe(false);
  });

  it("menolak account_id kosong", () => {
    const result = transactionSchema.safeParse({ ...BASE, account_id: "" });
    expect(result.success).toBe(false);
  });

  it("transfer tanpa transfer_account_id: ditolak", () => {
    const result = transactionSchema.safeParse({ ...BASE, type: "transfer", transfer_account_id: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("transfer_account_id"))).toBe(true);
    }
  });

  it("transfer dengan transfer_account_id sama seperti account_id: ditolak", () => {
    const result = transactionSchema.safeParse({
      ...BASE,
      type: "transfer",
      account_id: "acc-1",
      transfer_account_id: "acc-1",
    });
    expect(result.success).toBe(false);
  });

  it("transfer valid: diterima", () => {
    const result = transactionSchema.safeParse({
      ...BASE,
      type: "transfer",
      account_id: "acc-1",
      transfer_account_id: "acc-2",
    });
    expect(result.success).toBe(true);
  });

  it("amount string ter-coerce jadi number", () => {
    const result = transactionSchema.safeParse({ ...BASE, amount: "15000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(15000);
    }
  });
});
