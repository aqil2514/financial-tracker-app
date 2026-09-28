import { describe, expect, it } from "vitest";

import { buildArApPlanRows } from "./index";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { RetailkuSyncFieldMappingRow } from "../../types";

function arApRow(overrides: Partial<ArApRow> = {}): ArApRow {
  return {
    journalItemId: "j1",
    date: "2026-06-12",
    accountId: "acc-1",
    accountCode: "1500",
    accountName: "Piutang Dagang",
    sourceType: "SALE",
    direction: "receivable",
    partyId: "p1",
    partyName: "Budi",
    kind: "trade",
    cashAccounts: [],
    amount: 3000,
    sourceRef: "j1:ar_ap",
    isReversed: false,
    settledReceivablePayableJournalItemId: null,
    settledReceivablePayableJournalItemIds: [],
    ...overrides,
  };
}

function mapping(entries: [string, Partial<RetailkuSyncFieldMappingRow>][]): Map<string, RetailkuSyncFieldMappingRow> {
  return new Map(
    entries.map(([key, partial]) => [
      key,
      {
        key,
        localAccountId: 42,
        note: null,
        categoryId: null,
        description: null,
        extraFields: {},
        ...partial,
      },
    ])
  );
}

function createFakeDb(syncedSourceRefIds: Record<string, number> = {}) {
  return {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      if (sql.includes("FROM debts WHERE source_ref")) {
        const [sourceRef] = params as [string];
        const id = syncedSourceRefIds[sourceRef];
        return (id != null ? [{ id }] : []) as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(): Promise<{ lastInsertId?: number }> {
      throw new Error("Fake db.execute tidak dipakai buildArApPlanRows");
    },
  };
}

describe("buildArApPlanRows", () => {
  it("amount === 0 -> skipReason zero-amount, tidak cek mapping/idempotency", async () => {
    const db = createFakeDb();
    const result = await buildArApPlanRows(db as any, [arApRow({ amount: 0 })], mapping([]), "skip");

    expect(result.planRows[0].skipReason).toBe("zero-amount");
    expect(result.planRows[0].willInsert).toBe(false);
    expect(result.planRows[0].willUpdate).toBe(false);
  });

  it("amount < 0, isReversed true -> skipReason reversal", async () => {
    const db = createFakeDb();
    const result = await buildArApPlanRows(
      db as any,
      [arApRow({ amount: -500, isReversed: true })],
      mapping([]),
      "skip"
    );

    expect(result.planRows[0].skipReason).toBe("reversal");
    expect(result.planRows[0].willInsert).toBe(false);
  });

  it("amount < 0, isReversed false, settledReceivablePayableJournalItemId null -> skipReason settlement-not-supported", async () => {
    const db = createFakeDb();
    const result = await buildArApPlanRows(
      db as any,
      [arApRow({ amount: -500, isReversed: false, settledReceivablePayableJournalItemId: null })],
      mapping([]),
      "skip"
    );

    expect(result.planRows[0].skipReason).toBe("settlement-not-supported");
    expect(result.planRows[0].willInsert).toBe(false);
  });

  it("amount < 0, isReversed false, link ke piutang asli ADA tapi belum pernah sync -> skipReason settled-debt-not-found", async () => {
    const db = createFakeDb(); // "orig-item:ar_ap" TIDAK ada di debts
    const result = await buildArApPlanRows(
      db as any,
      [
        arApRow({
          amount: -500,
          isReversed: false,
          settledReceivablePayableJournalItemId: "orig-item",
        }),
      ],
      mapping([]),
      "skip"
    );

    expect(result.planRows[0].skipReason).toBe("settled-debt-not-found");
    expect(result.planRows[0].willInsert).toBe(false);
    expect(result.planRows[0].willInsertPayment).toBe(false);
  });

  it("amount < 0, isReversed false, piutang asli SUDAH pernah sync -> willInsertPayment true, paymentDebtId terisi", async () => {
    const db = createFakeDb({ "orig-item:ar_ap": 77 });
    const result = await buildArApPlanRows(
      db as any,
      [
        arApRow({
          amount: -500,
          isReversed: false,
          settledReceivablePayableJournalItemId: "orig-item",
        }),
      ],
      mapping([]),
      "skip"
    );

    expect(result.planRows[0]).toMatchObject({
      willInsert: false,
      willInsertPayment: true,
      paymentDebtId: 77,
      skipReason: null,
    });
  });

  it("consignment settlement: SEMUA debtId di array ketemu -> willInsertPayments terisi semua alokasi", async () => {
    const db = createFakeDb({ "item-a:ar_ap": 10, "item-b:ar_ap": 20 });
    const result = await buildArApPlanRows(
      db as any,
      [
        arApRow({
          amount: -4500,
          isReversed: false,
          settledReceivablePayableJournalItemIds: [
            { journalItemId: "item-a", amount: 1500 },
            { journalItemId: "item-b", amount: 3000 },
          ],
        }),
      ],
      mapping([]),
      "skip"
    );

    expect(result.planRows[0]).toMatchObject({
      willInsert: false,
      willInsertPayment: false,
      skipReason: null,
      willInsertPayments: [
        { debtId: 10, amount: 1500 },
        { debtId: 20, amount: 3000 },
      ],
    });
  });

  it("consignment settlement: SATU SAJA debtId tidak ketemu -> all-or-nothing, skipReason settlement-partially-not-found, willInsertPayments kosong", async () => {
    const db = createFakeDb({ "item-a:ar_ap": 10 }); // "item-b" TIDAK ada
    const result = await buildArApPlanRows(
      db as any,
      [
        arApRow({
          amount: -4500,
          isReversed: false,
          settledReceivablePayableJournalItemIds: [
            { journalItemId: "item-a", amount: 1500 },
            { journalItemId: "item-b", amount: 3000 },
          ],
        }),
      ],
      mapping([]),
      "skip"
    );

    expect(result.planRows[0].skipReason).toBe("settlement-partially-not-found");
    expect(result.planRows[0].willInsertPayments).toEqual([]);
  });

  it("akun debt unmapped -> skipReason unmapped-debt-account, masuk unmappedDebtKeys", async () => {
    const db = createFakeDb();
    const result = await buildArApPlanRows(db as any, [arApRow()], mapping([]), "skip");

    expect(result.planRows[0].skipReason).toBe("unmapped-debt-account");
    expect(result.unmappedDebtKeys).toEqual(["ar_ap:acc-1:receivable"]);
  });

  it("sudah pernah sync, mode skip (default) -> skipReason already-synced", async () => {
    const db = createFakeDb({ "j1:ar_ap": 100 });
    const fieldMapping = mapping([["ar_ap:acc-1:receivable", {}]]);
    const result = await buildArApPlanRows(db as any, [arApRow()], fieldMapping, "skip");

    expect(result.planRows[0].skipReason).toBe("already-synced");
    expect(result.planRows[0].willInsert).toBe(false);
    expect(result.planRows[0].willUpdate).toBe(false);
  });

  it("sudah pernah sync, mode overwrite -> willUpdate true, existingDebtId terisi", async () => {
    const db = createFakeDb({ "j1:ar_ap": 100 });
    const fieldMapping = mapping([
      ["ar_ap:acc-1:receivable", { localAccountId: 55, extraFields: { contactId: 8 } }],
    ]);
    const result = await buildArApPlanRows(db as any, [arApRow()], fieldMapping, "overwrite");

    expect(result.planRows[0]).toMatchObject({
      willInsert: false,
      willUpdate: true,
      existingDebtId: 100,
      skipReason: null,
      debtLocalAccountId: 55,
      contactId: 8,
    });
  });

  it("belum pernah sync, mode overwrite -> tetap insert biasa (willInsert true)", async () => {
    const db = createFakeDb();
    const fieldMapping = mapping([["ar_ap:acc-1:receivable", {}]]);
    const result = await buildArApPlanRows(db as any, [arApRow()], fieldMapping, "overwrite");

    expect(result.planRows[0]).toMatchObject({ willInsert: true, willUpdate: false });
  });

  it("lolos semua -> willInsert true, debtLocalAccountId/contactId/contactFollowSource terisi dari extraFields", async () => {
    const db = createFakeDb();
    const fieldMapping = mapping([
      [
        "ar_ap:acc-1:receivable",
        { localAccountId: 55, extraFields: { contactId: 8, contactFollowSource: true } },
      ],
    ]);
    const result = await buildArApPlanRows(db as any, [arApRow()], fieldMapping, "skip");

    expect(result.planRows[0]).toMatchObject({
      willInsert: true,
      skipReason: null,
      debtLocalAccountId: 55,
      contactId: 8,
      contactFollowSource: true,
    });
  });
});
