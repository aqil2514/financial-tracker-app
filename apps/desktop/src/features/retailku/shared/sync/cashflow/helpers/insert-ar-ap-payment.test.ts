import { describe, expect, it } from "vitest";

import { insertArApPayment } from "./insert-ar-ap-payment";
import type { ArApSyncPlanRow } from "../types";

function baseRow(overrides: Partial<ArApSyncPlanRow> = {}): ArApSyncPlanRow {
  return {
    journalItemId: "j1",
    date: "2026-08-09",
    accountId: "acc-1",
    accountName: "Piutang Dagang",
    direction: "receivable",
    kind: "trade",
    partyName: "Adel",
    amount: -3000,
    sourceRef: "j1:ar_ap",
    key: "ar_ap:acc-1:receivable",
    willInsert: false,
    willUpdate: false,
    existingDebtId: null,
    willInsertPayment: true,
    paymentDebtId: 77,
    willInsertPayments: [],
    skipReason: null,
    debtLocalAccountId: null,
    contactId: null,
    contactFollowSource: false,
    ...overrides,
  };
}

function createFakeDb() {
  const inserted: { sql: string; params: unknown[] }[] = [];
  const db = {
    async select<T>(): Promise<T> {
      throw new Error("Fake db.select tidak dipakai insertArApPayment");
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      inserted.push({ sql, params });
      return { lastInsertId: 1 };
    },
  };
  return { db, inserted };
}

describe("insertArApPayment", () => {
  it("insert debt_payments dengan amount dibalik jadi positif, account_id NULL, source retailku_sync", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow({ amount: -3000, paymentDebtId: 77, date: "2026-08-09", sourceRef: "j1:ar_ap" });

    await insertArApPayment(db as any, row);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].sql).toContain("INSERT INTO debt_payments");
    expect(inserted[0].sql).toContain("NULL");
    expect(inserted[0].sql).toContain("'retailku_sync'");
    expect(inserted[0].params).toEqual([77, 3000, "2026-08-09", "j1:ar_ap"]);
  });
});
