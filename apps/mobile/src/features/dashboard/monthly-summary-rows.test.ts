import { describe, expect, it } from "vitest";
import { buildMonthlySummaryRows } from "./monthly-summary-rows";

describe("buildMonthlySummaryRows", () => {
  it("selalu menghasilkan jumlah bulan yang diminta, berakhir di bulan akhir, lewat batas tahun", () => {
    const rows = buildMonthlySummaryRows([], 6, "2026-02");
    expect(rows.map((row) => row.month)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("mengisi 0 untuk bulan tanpa transaksi dan menempatkan total di bulan yang benar", () => {
    const rows = buildMonthlySummaryRows(
      [
        { month: "2026-10", type: "income", total: 500 },
        { month: "2026-11", type: "expense", total: 200 },
      ],
      3,
      "2026-11"
    );
    expect(rows).toEqual([
      { month: "2026-09", income: 0, expense: 0 },
      { month: "2026-10", income: 500, expense: 0 },
      { month: "2026-11", income: 0, expense: 200 },
    ]);
  });

  it("mengabaikan bulan di luar rentang", () => {
    const rows = buildMonthlySummaryRows([{ month: "2020-01", type: "income", total: 9 }], 2, "2026-11");
    expect(rows.every((row) => row.income === 0 && row.expense === 0)).toBe(true);
  });
});
