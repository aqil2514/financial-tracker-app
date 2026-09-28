import { describe, expect, it } from "vitest";

import { downPaymentSourceRef, insertArApDownPayment } from "./insert-ar-ap-down-payment";
import type { ArApSyncPlanRow } from "../types";

function baseRow(overrides: Partial<ArApSyncPlanRow> = {}): ArApSyncPlanRow {
  return {
    journalItemId: "j1",
    date: "2026-07-10",
    accountId: "acc-1",
    accountName: "Piutang Dagang",
    direction: "receivable",
    kind: "trade",
    partyName: "Adel",
    amount: 9000,
    sourceRef: "j1:ar_ap",
    key: "ar_ap:acc-1:receivable",
    willInsert: true,
    willUpdate: false,
    existingDebtId: null,
    willInsertPayment: false,
    paymentDebtId: null,
    willInsertPayments: [],
    paymentAccountId: null,
    downPayment: { amount: 18000, localAccountId: 30, note: "DP", categoryId: 5, description: null },
    skipReason: null,
    debtLocalAccountId: 42,
    contactId: null,
    contactFollowSource: false,
    ...overrides,
  };
}

function createFakeDb() {
  const inserted: { sql: string; params: unknown[] }[] = [];
  const db = {
    async select<T>(): Promise<T> {
      throw new Error("Fake db.select tidak dipakai insertArApDownPayment");
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      inserted.push({ sql, params });
      return { lastInsertId: 1 };
    },
  };
  return { db, inserted };
}

describe("downPaymentSourceRef", () => {
  it("diturunkan dari journalItemId, BUKAN sourceRef debts (beda dari source_ref piutangnya)", () => {
    expect(downPaymentSourceRef(baseRow({ journalItemId: "j1", sourceRef: "j1:ar_ap" }))).toBe("j1:ar_ap_dp");
  });
});

describe("insertArApDownPayment", () => {
  it("insert 1 baris transactions biasa (BUKAN debt_payments), amount/akun dari row.downPayment", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow();

    await insertArApDownPayment(db as any, row);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].sql).toContain("INSERT INTO transactions");
    expect(inserted[0].sql).not.toContain("debt_payments");
    expect(inserted[0].params).toEqual(["income", 18000, 30, "DP", 5, null, "2026-07-10T00:00", "j1:ar_ap_dp"]);
  });

  it("downPayment null -> tidak insert apa pun", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow({ downPayment: null });

    await insertArApDownPayment(db as any, row);

    expect(inserted).toHaveLength(0);
  });
});
