import { describe, expect, it } from "vitest";
import { buildWhereClause } from "./sql";
import type { FilterConfig } from "../filter.interface";

const ALLOWED = ["note", "type", "amount", "date"] as const;

describe("buildWhereClause", () => {
  it("filters kosong menghasilkan whereClause kosong", () => {
    const result = buildWhereClause([], ALLOWED);
    expect(result.whereClause).toBe("");
    expect(result.params).toEqual([]);
  });

  it("filterKey di luar allowedColumns: throw", () => {
    const filters: FilterConfig[] = [{ filterKey: "secret_column", filterOperator: "eq", filterValue: "x" }];
    expect(() => buildWhereClause(filters, ALLOWED)).toThrow(/tidak ada di allowedColumns/);
  });

  it("operator eq dengan satu value: IN dengan satu placeholder", () => {
    const filters: FilterConfig[] = [{ filterKey: "type", filterOperator: "eq", filterValue: "income" }];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("WHERE type IN ($1)");
    expect(result.params).toEqual(["income"]);
  });

  it("operator eq dengan array value: IN dengan banyak placeholder", () => {
    const filters: FilterConfig[] = [
      { filterKey: "type", filterOperator: "eq", filterValue: ["income", "expense"] },
    ];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("WHERE type IN ($1, $2)");
    expect(result.params).toEqual(["income", "expense"]);
  });

  it("operator neq: NOT IN", () => {
    const filters: FilterConfig[] = [{ filterKey: "type", filterOperator: "neq", filterValue: "income" }];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("WHERE NOT type IN ($1)");
  });

  it("operator ilike: LIKE dengan wildcard", () => {
    const filters: FilterConfig[] = [{ filterKey: "note", filterOperator: "ilike", filterValue: "kopi" }];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("WHERE note LIKE $1");
    expect(result.params).toEqual(["%kopi%"]);
  });

  it("operator ilike dengan value kosong: diabaikan", () => {
    const filters: FilterConfig[] = [{ filterKey: "note", filterOperator: "ilike", filterValue: "" }];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("");
  });

  it("operator between: BETWEEN dengan dua placeholder", () => {
    const filters: FilterConfig[] = [
      {
        filterKey: "date",
        filterOperator: "between",
        filterValue: { from: "2026-01-01", to: "2026-01-31" },
      },
    ];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("WHERE date BETWEEN $1 AND $2");
    expect(result.params).toEqual(["2026-01-01", "2026-01-31"]);
  });

  it("operator between dengan from/to null: diabaikan", () => {
    const filters: FilterConfig[] = [
      { filterKey: "date", filterOperator: "between", filterValue: { from: null, to: null } },
    ];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("");
  });

  it("operator gte: perbandingan angka", () => {
    const filters: FilterConfig[] = [{ filterKey: "amount", filterOperator: "gte", filterValue: 10000 }];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("WHERE amount >= $1");
    expect(result.params).toEqual([10000]);
  });

  it("beberapa filter sekaligus: digabung AND, nomor placeholder berurutan", () => {
    const filters: FilterConfig[] = [
      { filterKey: "type", filterOperator: "eq", filterValue: "expense" },
      { filterKey: "amount", filterOperator: "gte", filterValue: 5000 },
    ];
    const result = buildWhereClause(filters, ALLOWED);
    expect(result.whereClause).toBe("WHERE type IN ($1) AND amount >= $2");
    expect(result.params).toEqual(["expense", 5000]);
  });

  it("extraConditions ditempatkan sebelum filters, nomor placeholder tetap urut", () => {
    const filters: FilterConfig[] = [{ filterKey: "type", filterOperator: "eq", filterValue: "expense" }];
    const result = buildWhereClause(filters, ALLOWED, [
      { condition: "date BETWEEN $1 AND $2", params: ["2026-01-01", "2026-01-31"] },
    ]);
    expect(result.whereClause).toBe("WHERE date BETWEEN $1 AND $2 AND type IN ($3)");
    expect(result.params).toEqual(["2026-01-01", "2026-01-31", "expense"]);
  });

  it("operator yang tidak dikenal: throw", () => {
    const filters = [{ filterKey: "type", filterOperator: "unknown_op", filterValue: "x" }] as unknown as FilterConfig[];
    expect(() => buildWhereClause(filters, ALLOWED)).toThrow(/belum didukung/);
  });
});
