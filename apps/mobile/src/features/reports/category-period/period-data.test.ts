import { describe, expect, it } from "vitest";
import type { TransactionListItem } from "@/features/transactions/types";
import { dailyIncomeExpense, summarizePeriod, toPeriodPieRows } from "./period-data";

function tx(overrides: Partial<TransactionListItem>): TransactionListItem {
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
    ...overrides,
  };
}

describe("summarizePeriod", () => {
  it("menjumlah pemasukan dan pengeluaran, mengabaikan tipe lain", () => {
    expect(
      summarizePeriod([
        tx({ type: "income", amount: 500 }),
        tx({ type: "expense", amount: 120 }),
        tx({ type: "expense", amount: 30 }),
        tx({ type: "transfer", amount: 999 }),
      ])
    ).toEqual({ income: 500, expense: 150 });
  });

  it("tanpa transaksi: nol", () => {
    expect(summarizePeriod([])).toEqual({ income: 0, expense: 0 });
  });
});

describe("toPeriodPieRows", () => {
  it("dua irisan dengan persen terhadap jumlah keduanya dan warna tetap", () => {
    const rows = toPeriodPieRows({ income: 750, expense: 250 });
    expect(rows.map((r) => [r.group_key, r.percent])).toEqual([
      ["income", 75],
      ["expense", 25],
    ]);
    expect(rows[0].color).toBe("#22c55e");
    expect(rows[1].color).toBe("#ef4444");
  });

  it("irisan bernilai 0 dibuang dan warna tidak bergeser", () => {
    const rows = toPeriodPieRows({ income: 0, expense: 300 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ group_key: "expense", percent: 100, color: "#ef4444" });
  });

  it("kosong: tanpa irisan", () => {
    expect(toPeriodPieRows({ income: 0, expense: 0 })).toEqual([]);
  });
});

describe("dailyIncomeExpense", () => {
  it("menggabungkan per tanggal (jam berbeda) dan mengurutkan naik", () => {
    const result = dailyIncomeExpense([
      tx({ type: "expense", amount: 10, date: "2026-11-05T09:00" }),
      tx({ type: "income", amount: 70, date: "2026-11-04T08:00" }),
      tx({ type: "expense", amount: 5, date: "2026-11-04T22:30" }),
    ]);
    expect(result).toEqual({
      dates: ["2026-11-04", "2026-11-05"],
      income: [70, 0],
      expense: [5, 10],
    });
  });
});
