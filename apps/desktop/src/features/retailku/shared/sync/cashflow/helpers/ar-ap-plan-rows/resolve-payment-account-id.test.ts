import { describe, expect, it } from "vitest";

import { resolvePaymentAccountId } from "./resolve-payment-account-id";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { RetailkuSyncFieldMappingRow } from "../../types";

function arApRow(overrides: Partial<ArApRow> = {}): ArApRow {
  return {
    journalItemId: "j1",
    date: "2026-08-09",
    accountId: "acc-1",
    accountCode: "1500",
    accountName: "Piutang Dagang",
    sourceType: "SALE_PAYMENT",
    direction: "receivable",
    partyId: "p1",
    partyName: "Adel",
    kind: "trade",
    cashAccounts: [],
    amount: -500,
    sourceRef: "j1:ar_ap",
    isReversed: false,
    settledReceivablePayableJournalItemId: "orig-item",
    settledReceivablePayableJournalItemIds: [],
    ...overrides,
  };
}

function mapping(entries: [string, number][]): Map<string, RetailkuSyncFieldMappingRow> {
  return new Map(
    entries.map(([key, localAccountId]) => [
      key,
      { key, localAccountId, note: null, categoryId: null, description: null, extraFields: {} },
    ])
  );
}

describe("resolvePaymentAccountId", () => {
  it("cashAccounts kosong -> null", () => {
    const result = resolvePaymentAccountId(arApRow({ cashAccounts: [] }), mapping([]), "detail");
    expect(result).toBeNull();
  });

  it("cashAccounts tepat 1 dan sudah dipetakan -> localAccountId terisi", () => {
    const fieldMapping = mapping([["detail:kas-tunai:SALE_PAYMENT:inflow", 9]]);
    const result = resolvePaymentAccountId(
      arApRow({ cashAccounts: [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 500 }] }),
      fieldMapping,
      "detail"
    );
    expect(result).toBe(9);
  });

  it("cashAccounts tepat 1 tapi belum dipetakan -> null", () => {
    const result = resolvePaymentAccountId(
      arApRow({ cashAccounts: [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 500 }] }),
      mapping([]),
      "detail"
    );
    expect(result).toBeNull();
  });

  it("cashAccounts >1 (split, belum pernah terjadi di data nyata) -> null", () => {
    const fieldMapping = mapping([
      ["detail:kas-tunai:SALE_PAYMENT:inflow", 9],
      ["detail:seabank:SALE_PAYMENT:inflow", 11],
    ]);
    const result = resolvePaymentAccountId(
      arApRow({
        cashAccounts: [
          { accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 200 },
          { accountId: "seabank", accountCode: "1102", accountName: "Seabank", amount: 300 },
        ],
      }),
      fieldMapping,
      "detail"
    );
    expect(result).toBeNull();
  });

  it("mode summary -> key tanpa sourceType, tetap resolve", () => {
    const fieldMapping = mapping([["summary:inflow:kas-tunai", 9]]);
    const result = resolvePaymentAccountId(
      arApRow({ cashAccounts: [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 500 }] }),
      fieldMapping,
      "summary"
    );
    expect(result).toBe(9);
  });
});
