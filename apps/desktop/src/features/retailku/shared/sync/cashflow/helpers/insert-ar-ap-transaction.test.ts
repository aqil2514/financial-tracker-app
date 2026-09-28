import { beforeEach, describe, expect, it, vi } from "vitest";

import { insertArApTransaction } from "./insert-ar-ap-transaction";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import type { ArApSyncPlanRow } from "../types";

vi.mock("@/shared/contacts/resolve-contact", () => ({
  resolveContactId: vi.fn(),
}));

function baseRow(overrides: Partial<ArApSyncPlanRow> = {}): ArApSyncPlanRow {
  return {
    journalItemId: "j1",
    date: "2026-06-12",
    accountId: "acc-1",
    accountName: "Piutang Dagang",
    direction: "receivable",
    kind: "trade",
    partyName: "Budi",
    amount: 3000,
    sourceRef: "j1:ar_ap",
    key: "ar_ap:acc-1:receivable",
    willInsert: true,
    willUpdate: false,
    existingDebtId: null,
    willInsertPayment: false,
    paymentDebtId: null,
    willInsertPayments: [],
    skipReason: null,
    debtLocalAccountId: 42,
    contactId: 7,
    contactFollowSource: false,
    ...overrides,
  };
}

function createFakeDb() {
  const inserted: { sql: string; params: unknown[] }[] = [];
  const db = {
    async select<T>(): Promise<T> {
      throw new Error("Fake db.select tidak dipakai insert-ar-ap-transaction");
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      inserted.push({ sql, params });
      return { lastInsertId: 1 };
    },
  };
  return { db, inserted };
}

describe("insertArApTransaction", () => {
  beforeEach(() => {
    vi.mocked(resolveContactId).mockReset();
  });

  it("contactFollowSource false -> pakai row.contactId langsung, resolveContactId TIDAK dipanggil", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow({ contactFollowSource: false, contactId: 7 });

    await insertArApTransaction(db as any, row);

    expect(resolveContactId).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(1);
    expect(inserted[0].sql).toContain("INSERT INTO debts");
    expect(inserted[0].params).toEqual(["receivable", 7, 3000, 42, "2026-06-12", "j1:ar_ap"]);
  });

  it("contactFollowSource true -> resolveContactId dipanggil dengan partyName", async () => {
    vi.mocked(resolveContactId).mockResolvedValue(99);
    const { db, inserted } = createFakeDb();
    const row = baseRow({ contactFollowSource: true, contactId: null, partyName: "Budi" });

    await insertArApTransaction(db as any, row);

    expect(resolveContactId).toHaveBeenCalledWith("Budi");
    expect(inserted[0].params[1]).toBe(99);
  });

  it("insert debts dengan transaction_id NULL dan source/source_ref retailku_sync", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow({ direction: "payable", sourceRef: "j2:ar_ap" });

    await insertArApTransaction(db as any, row);

    expect(inserted[0].sql).toContain("transaction_id, date, source, source_ref");
    expect(inserted[0].sql).toContain("NULL");
    expect(inserted[0].sql).toContain("'retailku_sync'");
    expect(inserted[0].params).toContain("j2:ar_ap");
  });

  it("willUpdate true -> UPDATE debts by existingDebtId, TIDAK INSERT baris baru", async () => {
    const { db, inserted } = createFakeDb();
    const row = baseRow({
      willInsert: false,
      willUpdate: true,
      existingDebtId: 100,
      amount: 5000,
      debtLocalAccountId: 99,
    });

    await insertArApTransaction(db as any, row);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].sql).toContain("UPDATE debts");
    expect(inserted[0].sql).not.toContain("INSERT INTO debts");
    expect(inserted[0].params).toEqual(["receivable", 7, 5000, 99, "2026-06-12", 100]);
  });

  it("willUpdate true + contactFollowSource true -> tetap resolveContactId dulu sebelum UPDATE", async () => {
    vi.mocked(resolveContactId).mockResolvedValue(55);
    const { db, inserted } = createFakeDb();
    const row = baseRow({
      willInsert: false,
      willUpdate: true,
      existingDebtId: 100,
      contactFollowSource: true,
      contactId: null,
      partyName: "Nenek Petok",
    });

    await insertArApTransaction(db as any, row);

    expect(resolveContactId).toHaveBeenCalledWith("Nenek Petok");
    expect(inserted[0].params[1]).toBe(55);
  });
});
