import { describe, expect, it } from "vitest";
import { buildDateFilter, buildMonthFilter, shiftMonth, withDateScope } from "./date-filter";

describe("buildDateFilter", () => {
  it("membuat rentang 00:00:00 - 23:59:59 untuk satu tanggal kalender", () => {
    const filter = buildDateFilter("2026-03-15");
    expect(filter.filterKey).toBe("date");
    expect(filter.filterOperator).toBe("between");
    expect(filter.filterValue).toEqual({
      from: "2026-03-15T00:00:00",
      to: "2026-03-15T23:59:59",
    });
  });
});

describe("buildMonthFilter", () => {
  it("rentang awal sampai akhir bulan, termasuk Februari kabisat", () => {
    expect(buildMonthFilter("2026-11").filterValue).toEqual({
      from: "2026-11-01T00:00:00",
      to: "2026-11-30T23:59:59",
    });
    expect(buildMonthFilter("2028-02").filterValue).toEqual({
      from: "2028-02-01T00:00:00",
      to: "2028-02-29T23:59:59",
    });
  });
});

describe("shiftMonth", () => {
  it("melewati batas tahun", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("withDateScope", () => {
  const other = { filterKey: "type", filterOperator: "eq" as const, filterValue: "income" };

  it("semua waktu tanpa hari: filter dikembalikan apa adanya", () => {
    expect(withDateScope([other], null, null)).toEqual([other]);
  });

  it("bulan ditambahkan sebagai filter tanggal", () => {
    expect(withDateScope([other], "2026-11", null)).toEqual([other, buildMonthFilter("2026-11")]);
  });

  it("hari mengalahkan bulan dan tidak mengubah filter lain", () => {
    expect(withDateScope([other], "2026-11", "2026-11-04")).toEqual([
      other,
      buildDateFilter("2026-11-04"),
    ]);
  });
});
