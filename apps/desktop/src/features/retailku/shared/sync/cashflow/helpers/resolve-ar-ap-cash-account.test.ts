import { describe, expect, it } from "vitest";

import { resolveArApCashAccounts } from "./resolve-ar-ap-cash-account";
import type { RetailkuSyncFieldMappingRow } from "../types";

function mapping(entries: [string, string][]): Map<string, RetailkuSyncFieldMappingRow> {
  return new Map(
    entries.map(([key, localAccountId]) => [
      key,
      { key, localAccountId, note: null, categoryId: null, description: null, extraFields: {} },
    ])
  );
}

describe("resolveArApCashAccounts", () => {
  it("baris tanpa cashAccounts (piutang dagang baru murni) menghasilkan array kosong", () => {
    const result = resolveArApCashAccounts([], "SALE", "detail", mapping([]));
    expect(result).toEqual([]);
  });

  it("mode detail: cocokkan by accountId+sourceType+arah, sama seperti key cashflow biasa", () => {
    const fieldMapping = mapping([["detail:kas-tunai:SALE:inflow", "10"]]);
    const result = resolveArApCashAccounts(
      [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 2000 }],
      "SALE",
      "detail",
      fieldMapping
    );
    expect(result).toEqual([
      {
        accountId: "kas-tunai",
        accountName: "Kas Tunai",
        amount: 2000,
        key: "detail:kas-tunai:SALE:inflow",
        localAccountId: "10",
      },
    ]);
  });

  it("mode summary: cocokkan by accountId+arah saja, TANPA sourceType", () => {
    const fieldMapping = mapping([["summary:inflow:kas-tunai", "10"]]);
    const result = resolveArApCashAccounts(
      [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 2000 }],
      "SALE",
      "summary",
      fieldMapping
    );
    expect(result[0].key).toBe("summary:inflow:kas-tunai");
    expect(result[0].localAccountId).toBe("10");
  });

  it("amount negatif menghasilkan arah outflow, bukan inflow", () => {
    const fieldMapping = mapping([["detail:seabank:CONSIGNMENT_SETTLEMENT:outflow", "20"]]);
    const result = resolveArApCashAccounts(
      [{ accountId: "seabank", accountCode: "1102", accountName: "Seabank", amount: -16500 }],
      "CONSIGNMENT_SETTLEMENT",
      "detail",
      fieldMapping
    );
    expect(result[0].key).toBe("detail:seabank:CONSIGNMENT_SETTLEMENT:outflow");
    expect(result[0].localAccountId).toBe("20");
  });

  it("key belum ada di fieldMapping -> localAccountId null (unmapped), bukan error", () => {
    const result = resolveArApCashAccounts(
      [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 2000 }],
      "SALE",
      "detail",
      mapping([])
    );
    expect(result[0].localAccountId).toBeNull();
  });

  it("sourceType null (mode detail) jatuh ke bucket LAINNYA, sama seperti aggregate-by-date-account-and-source-type.ts", () => {
    const fieldMapping = mapping([["detail:kas-tunai:LAINNYA:inflow", "10"]]);
    const result = resolveArApCashAccounts(
      [{ accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 2000 }],
      null,
      "detail",
      fieldMapping
    );
    expect(result[0].key).toBe("detail:kas-tunai:LAINNYA:inflow");
    expect(result[0].localAccountId).toBe("10");
  });

  it("split bill: >1 cashAccounts diresolusikan masing-masing secara independen", () => {
    const fieldMapping = mapping([
      ["detail:kas-tunai:SALE:inflow", "10"],
      ["detail:seabank:SALE:inflow", "20"],
    ]);
    const result = resolveArApCashAccounts(
      [
        { accountId: "kas-tunai", accountCode: "1101", accountName: "Kas Tunai", amount: 50000 },
        { accountId: "seabank", accountCode: "1102", accountName: "Seabank", amount: 50000 },
      ],
      "SALE",
      "detail",
      fieldMapping
    );
    expect(result).toHaveLength(2);
    expect(result[0].localAccountId).toBe("10");
    expect(result[1].localAccountId).toBe("20");
  });
});
