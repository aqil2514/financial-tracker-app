import { describe, expect, it } from "vitest";
import {
  computeChildRows,
  dailyTotals,
  filterByChild,
  totalAmount,
  type CashflowDetailTransaction,
} from "./cashflow-detail-data";

function tx(overrides: Partial<CashflowDetailTransaction>): CashflowDetailTransaction {
  return {
    id: "t",
    note: "",
    description: null,
    type: "expense",
    category: null,
    account: "Kas",
    transferAccount: null,
    amount: 100,
    date: "2026-11-04T10:00",
    hasAttachment: false,
    accountId: "a1",
    categoryId: null,
    ...overrides,
  };
}

describe("computeChildRows (grup akun)", () => {
  it("menjumlah per akun dan mengurutkan dari yang terbesar", () => {
    const rows = computeChildRows(
      [
        tx({ accountId: "a1", account: "Kas", amount: 100 }),
        tx({ accountId: "a2", account: "Bank", amount: 500 }),
        tx({ accountId: "a1", account: "Kas", amount: 50 }),
      ],
      "account_group",
      "g1"
    );
    expect(rows).toEqual([
      { value: "a2", label: "Bank", total: 500 },
      { value: "a1", label: "Kas", total: 150 },
    ]);
  });
});

describe("computeChildRows (kategori induk)", () => {
  it("hanya kategori anak; transaksi pada induk sendiri dan tanpa kategori tidak jadi baris anak", () => {
    const rows = computeChildRows(
      [
        tx({ categoryId: "child1", category: "Sarapan", amount: 10 }),
        tx({ categoryId: "parent", category: "Makanan", amount: 99 }),
        tx({ categoryId: null, category: null, amount: 7 }),
      ],
      "parent_category",
      "parent"
    );
    expect(rows).toEqual([{ value: "child1", label: "Sarapan", total: 10 }]);
  });
});

describe("filterByChild", () => {
  const list = [
    tx({ id: "1", accountId: "a1", categoryId: "c1" }),
    tx({ id: "2", accountId: "a2", categoryId: "c2" }),
  ];

  it("tanpa anak terpilih mengembalikan semua", () => {
    expect(filterByChild(list, "account_group", null)).toHaveLength(2);
  });

  it("memfilter menurut akun atau kategori sesuai pengelompokan", () => {
    expect(filterByChild(list, "account_group", "a2").map((t) => t.id)).toEqual(["2"]);
    expect(filterByChild(list, "parent_category", "c1").map((t) => t.id)).toEqual(["1"]);
  });
});

describe("dailyTotals & totalAmount", () => {
  it("menggabungkan transaksi sehari (jam berbeda) dan mengurutkan naik", () => {
    const list = [
      tx({ date: "2026-11-05T09:00", amount: 10 }),
      tx({ date: "2026-11-04T08:00", amount: 20 }),
      tx({ date: "2026-11-04T22:30", amount: 5 }),
    ];
    expect(dailyTotals(list)).toEqual([
      { date: "2026-11-04", total: 25 },
      { date: "2026-11-05", total: 10 },
    ]);
    expect(totalAmount(list)).toBe(35);
  });
});
