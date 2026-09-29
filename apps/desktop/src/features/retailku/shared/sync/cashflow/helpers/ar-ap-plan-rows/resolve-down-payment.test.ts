import { describe, expect, it } from "vitest";

import { resolveDownPayment } from "./resolve-down-payment";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { RetailkuSyncFieldMappingRow } from "../../types";

function arApRow(overrides: Partial<ArApRow> = {}): ArApRow {
  return {
    journalItemId: "j1",
    date: "2026-07-10",
    accountId: "acc-1",
    accountCode: "1500",
    accountName: "Piutang Dagang",
    sourceType: "SALE",
    direction: "receivable",
    partyId: "p1",
    partyName: "Adel",
    kind: "trade",
    cashAccounts: [],
    amount: 9000,
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
      { key, localAccountId: "1", note: null, categoryId: null, description: null, extraFields: {}, ...partial },
    ])
  );
}

describe("resolveDownPayment", () => {
  it("cashAccounts kosong (piutang murni, tanpa DP) -> null", () => {
    const result = resolveDownPayment(arApRow({ cashAccounts: [] }), mapping([]), "detail");
    expect(result).toBeNull();
  });

  it("cashAccounts tepat 1, positif, sudah dipetakan -> resolved dgn amount dari cashAccounts", () => {
    const fieldMapping = mapping([
      ["detail:kas-tunai:SALE:inflow", { localAccountId: "30", note: "DP custom", categoryId: "5" }],
    ]);
    const result = resolveDownPayment(
      arApRow({ cashAccounts: [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 18000 }] }),
      fieldMapping,
      "detail"
    );
    expect(result).toEqual({ amount: 18000, localAccountId: "30", note: "DP custom", categoryId: "5", description: null });
  });

  it("belum dipetakan -> null (DP tidak dicatat, tapi tidak error)", () => {
    const result = resolveDownPayment(
      arApRow({ cashAccounts: [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 18000 }] }),
      mapping([]),
      "detail"
    );
    expect(result).toBeNull();
  });

  it("cashAccounts negatif (kas KELUAR, mis. talangan LEDGER_ENTRY) -> null, bukan pola DP", () => {
    const fieldMapping = mapping([["detail:kas-tunai:LEDGER_ENTRY:outflow", { localAccountId: "30" }]]);
    const result = resolveDownPayment(
      arApRow({
        sourceType: "LEDGER_ENTRY",
        kind: "non-trade",
        cashAccounts: [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: -10000 }],
      }),
      fieldMapping,
      "detail"
    );
    expect(result).toBeNull();
  });

  it("cashAccounts >1 (campuran, mis. payout PPOB Seabank) -> null, bukan pola DP murni", () => {
    const fieldMapping = mapping([
      ["detail:kas-tunai:SALE:inflow", { localAccountId: "30" }],
      ["detail:seabank:SALE:outflow", { localAccountId: "40" }],
    ]);
    const result = resolveDownPayment(
      arApRow({
        cashAccounts: [
          { accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 5000 },
          { accountId: "seabank", accountCode: "1102", accountName: "Seabank", amount: -6940 },
        ],
      }),
      fieldMapping,
      "detail"
    );
    expect(result).toBeNull();
  });

  it("note fallback ke template default kalau mapping.note null", () => {
    const fieldMapping = mapping([["detail:kas-tunai:SALE:inflow", { localAccountId: "30", note: null }]]);
    const result = resolveDownPayment(
      arApRow({ cashAccounts: [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 18000 }] }),
      fieldMapping,
      "detail"
    );
    expect(result?.note).toBe("Kas Harian Retailku — Kas Tunai — SALE (DP)");
  });

  it("mode summary -> key tanpa sourceType, tetap resolve", () => {
    const fieldMapping = mapping([["summary:inflow:kas-tunai", { localAccountId: "30" }]]);
    const result = resolveDownPayment(
      arApRow({ cashAccounts: [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 18000 }] }),
      fieldMapping,
      "summary"
    );
    expect(result?.localAccountId).toBe("30");
  });
});
