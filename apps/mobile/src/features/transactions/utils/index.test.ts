import { describe, expect, it } from "vitest";
import { formatTimeLabel, groupByDate } from "./index";
import { TransactionListItem } from "../types";

function item(overrides: Partial<TransactionListItem> = {}): TransactionListItem {
  return {
    id: "tx-1",
    note: "Makan",
    description: null,
    type: "expense",
    category: null,
    account: "Dompet",
    transferAccount: null,
    amount: 10000,
    date: "2026-01-01T08:00:00",
    hasAttachment: false,
    ...overrides,
  };
}

describe("groupByDate", () => {
  it("mengelompokkan transaksi dengan tanggal sama walau jam beda", () => {
    const result = groupByDate([
      item({ id: "tx-1", date: "2026-01-01T08:00:00" }),
      item({ id: "tx-2", date: "2026-01-01T20:00:00" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("2026-01-01");
    expect(result[0].data).toHaveLength(2);
  });

  it("memisahkan transaksi dengan tanggal berbeda jadi grup berbeda", () => {
    const result = groupByDate([
      item({ id: "tx-1", date: "2026-01-01T08:00:00" }),
      item({ id: "tx-2", date: "2026-01-02T08:00:00" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((g) => g.title)).toEqual(["2026-01-01", "2026-01-02"]);
  });

  it("list kosong menghasilkan array kosong", () => {
    expect(groupByDate([])).toEqual([]);
  });
});

describe("formatTimeLabel", () => {
  it("memformat jam dari datetime ISO", () => {
    const label = formatTimeLabel("2026-01-01T08:05:00");
    expect(label).toMatch(/08[.:]05/);
  });
});
