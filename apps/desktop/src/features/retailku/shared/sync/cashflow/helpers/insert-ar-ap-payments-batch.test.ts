import { describe, expect, it } from "vitest";

import { insertArApPaymentsBatch } from "./insert-ar-ap-payments-batch";
import type { ArApSyncPlanRow } from "../types";

function baseRow(overrides: Partial<ArApSyncPlanRow> = {}): ArApSyncPlanRow {
  return {
    journalItemId: "j1",
    date: "2026-09-18",
    accountId: "acc-1",
    accountName: "Hutang ke Penitip",
    direction: "payable",
    kind: "trade",
    partyName: "Mba-mba Kado Kuning",
    amount: -6000,
    sourceRef: "j1:ar_ap",
    key: "ar_ap:acc-1:payable",
    willInsert: false,
    willUpdate: false,
    existingDebtId: null,
    willInsertPayment: false,
    paymentDebtId: null,
    willInsertPayments: [
      { debtId: "10", amount: 1500 },
      { debtId: "20", amount: 3000 },
    ],
    paymentAccountId: null,
    downPayment: null,
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
      throw new Error("Fake db.select tidak dipakai insertArApPaymentsBatch");
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      inserted.push({ sql, params });
      return { lastInsertId: 1 };
    },
  };
  return { db, inserted };
}

describe("insertArApPaymentsBatch", () => {
  it("insert 1 baris debt_payments PER alokasi, source_ref unik per debtId, account_id NULL (belum dipetakan)", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow();

    await insertArApPaymentsBatch(db as any, row);

    expect(inserted).toHaveLength(2);
    expect(inserted[0].sql).toContain("INSERT INTO debt_payments");
    expect(inserted[0].params).toEqual([expect.any(String), "10", 1500, null, "2026-09-18", "j1:ar_ap:10"]);
    expect(inserted[1].params).toEqual([expect.any(String), "20", 3000, null, "2026-09-18", "j1:ar_ap:20"]);
  });

  it("paymentAccountId terisi -> account_id SAMA untuk semua alokasi", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow({ paymentAccountId: "5" });

    await insertArApPaymentsBatch(db as any, row);

    expect(inserted[0].params).toEqual([expect.any(String), "10", 1500, "5", "2026-09-18", "j1:ar_ap:10"]);
    expect(inserted[1].params).toEqual([expect.any(String), "20", 3000, "5", "2026-09-18", "j1:ar_ap:20"]);
  });

  it("willInsertPayments kosong -> tidak insert apa pun", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow({ willInsertPayments: [] });

    await insertArApPaymentsBatch(db as any, row);

    expect(inserted).toHaveLength(0);
  });
});
