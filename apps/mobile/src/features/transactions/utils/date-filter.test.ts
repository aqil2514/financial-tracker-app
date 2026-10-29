import { describe, expect, it } from "vitest";
import { buildDateFilter, replaceDateFilter } from "./date-filter";

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

describe("replaceDateFilter", () => {
  it("menambah filter tanggal baru kalau belum ada filter tanggal sebelumnya", () => {
    const result = replaceDateFilter([], "2026-03-15");
    expect(result).toHaveLength(1);
    expect(result[0].filterKey).toBe("date");
  });

  it("menggantikan filter tanggal lama, bukan menambah duplikat", () => {
    const first = replaceDateFilter([], "2026-03-15");
    const second = replaceDateFilter(first, "2026-03-20");

    expect(second).toHaveLength(1);
    expect(second[0].filterValue).toEqual({
      from: "2026-03-20T00:00:00",
      to: "2026-03-20T23:59:59",
    });
  });

  it("tidak mengubah filter lain yang bukan filter tanggal", () => {
    const otherFilter = { filterKey: "type", filterOperator: "eq" as const, filterValue: "income" };
    const result = replaceDateFilter([otherFilter], "2026-03-15");

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(otherFilter);
  });
});
