import { describe, expect, it } from "vitest";
import { buildWhereClause } from "./sql";

const ALLOWED_COLUMNS = ["note", "type", "category_id", "amount"] as const;

describe("buildWhereClause", () => {
  it("returns empty whereClause and params when there are no filters", () => {
    expect(buildWhereClause([], ALLOWED_COLUMNS)).toEqual({
      whereClause: "",
      params: [],
    });
  });

  it("skips filters with an empty filterKey", () => {
    const result = buildWhereClause(
      [{ filterKey: "", filterOperator: "eq", filterValue: "x" }],
      ALLOWED_COLUMNS
    );
    expect(result).toEqual({ whereClause: "", params: [] });
  });

  it("throws when filterKey is not in allowedColumns", () => {
    expect(() =>
      buildWhereClause(
        [{ filterKey: "secret_column", filterOperator: "eq", filterValue: "x" }],
        ALLOWED_COLUMNS
      )
    ).toThrow(/secret_column/);
  });

  it("throws on an unrecognized operator", () => {
    expect(() =>
      buildWhereClause(
        [
          {
            filterKey: "note",
            // @ts-expect-error deliberately invalid operator for this test
            filterOperator: "not_a_real_operator",
            filterValue: "x",
          },
        ],
        ALLOWED_COLUMNS
      )
    ).toThrow(/not_a_real_operator/);
  });

  describe("is_null / is_not_null", () => {
    it("builds IS NULL with no params", () => {
      const result = buildWhereClause(
        [{ filterKey: "note", filterOperator: "is_null", filterValue: null }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({ whereClause: "WHERE note IS NULL", params: [] });
    });

    it("builds IS NOT NULL with no params", () => {
      const result = buildWhereClause(
        [{ filterKey: "note", filterOperator: "is_not_null", filterValue: null }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: "WHERE note IS NOT NULL",
        params: [],
      });
    });
  });

  describe("ilike / not_ilike", () => {
    it("builds LIKE with wrapped wildcard param", () => {
      const result = buildWhereClause(
        [{ filterKey: "note", filterOperator: "ilike", filterValue: "kopi" }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: "WHERE note LIKE $1",
        params: ["%kopi%"],
      });
    });

    it("builds NOT LIKE", () => {
      const result = buildWhereClause(
        [{ filterKey: "note", filterOperator: "not_ilike", filterValue: "kopi" }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: "WHERE NOT note LIKE $1",
        params: ["%kopi%"],
      });
    });

    it("skips ilike when value is an empty string", () => {
      const result = buildWhereClause(
        [{ filterKey: "note", filterOperator: "ilike", filterValue: "" }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({ whereClause: "", params: [] });
    });

    it("skips ilike when value is not a string", () => {
      const result = buildWhereClause(
        [{ filterKey: "note", filterOperator: "ilike", filterValue: 123 }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({ whereClause: "", params: [] });
    });
  });

  describe("eq / neq", () => {
    it("builds IN with a single scalar value", () => {
      const result = buildWhereClause(
        [{ filterKey: "type", filterOperator: "eq", filterValue: "income" }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: "WHERE type IN ($1)",
        params: ["income"],
      });
    });

    it("builds IN with multiple values using sequential placeholders (regression: previously all placeholders collapsed to $1)", () => {
      const result = buildWhereClause(
        [
          {
            filterKey: "category_id",
            filterOperator: "eq",
            filterValue: ["1", "2", "3"],
          },
        ],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: "WHERE category_id IN ($1, $2, $3)",
        params: ["1", "2", "3"],
      });
    });

    it("builds NOT IN for neq with multiple values", () => {
      const result = buildWhereClause(
        [
          {
            filterKey: "category_id",
            filterOperator: "neq",
            filterValue: ["1", "2"],
          },
        ],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: "WHERE NOT category_id IN ($1, $2)",
        params: ["1", "2"],
      });
    });

    it("skips eq when value is an empty array", () => {
      const result = buildWhereClause(
        [{ filterKey: "category_id", filterOperator: "eq", filterValue: [] }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({ whereClause: "", params: [] });
    });

    it("skips eq when value is null", () => {
      const result = buildWhereClause(
        [{ filterKey: "category_id", filterOperator: "eq", filterValue: null }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({ whereClause: "", params: [] });
    });
  });

  describe("gt / gte / lt / lte", () => {
    it.each([
      ["gt", ">"],
      ["gte", ">="],
      ["lt", "<"],
      ["lte", "<="],
    ] as const)("builds %s as SQL %s", (operator, sqlOperator) => {
      const result = buildWhereClause(
        [{ filterKey: "amount", filterOperator: operator, filterValue: 1000 }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: `WHERE amount ${sqlOperator} $1`,
        params: [1000],
      });
    });

    it("skips comparison operators when value is not a number", () => {
      const result = buildWhereClause(
        [{ filterKey: "amount", filterOperator: "gt", filterValue: "not-a-number" }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({ whereClause: "", params: [] });
    });
  });

  describe("between / not_between", () => {
    it("builds BETWEEN with from/to params in order", () => {
      const result = buildWhereClause(
        [
          {
            filterKey: "amount",
            filterOperator: "between",
            filterValue: { from: 1000, to: 5000 },
          },
        ],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: "WHERE amount BETWEEN $1 AND $2",
        params: [1000, 5000],
      });
    });

    it("builds NOT BETWEEN", () => {
      const result = buildWhereClause(
        [
          {
            filterKey: "amount",
            filterOperator: "not_between",
            filterValue: { from: 1000, to: 5000 },
          },
        ],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause: "WHERE NOT amount BETWEEN $1 AND $2",
        params: [1000, 5000],
      });
    });

    it("skips between when from is missing", () => {
      const result = buildWhereClause(
        [
          {
            filterKey: "amount",
            filterOperator: "between",
            filterValue: { from: null, to: 5000 },
          },
        ],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({ whereClause: "", params: [] });
    });

    it("skips between when value is null", () => {
      const result = buildWhereClause(
        [{ filterKey: "amount", filterOperator: "between", filterValue: null }],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({ whereClause: "", params: [] });
    });
  });

  describe("multiple filters combined", () => {
    it("joins multiple conditions with AND and keeps params in order", () => {
      const result = buildWhereClause(
        [
          { filterKey: "note", filterOperator: "ilike", filterValue: "kopi" },
          {
            filterKey: "category_id",
            filterOperator: "eq",
            filterValue: ["1", "2"],
          },
          { filterKey: "amount", filterOperator: "gte", filterValue: 1000 },
        ],
        ALLOWED_COLUMNS
      );
      expect(result).toEqual({
        whereClause:
          "WHERE note LIKE $1 AND category_id IN ($2, $3) AND amount >= $4",
        params: ["%kopi%", "1", "2", 1000],
      });
    });
  });

  describe("extraConditions", () => {
    it("prepends extraConditions before filter conditions with correct param offsets", () => {
      const result = buildWhereClause(
        [{ filterKey: "note", filterOperator: "ilike", filterValue: "kopi" }],
        ALLOWED_COLUMNS,
        [{ condition: "date(date) = $1", params: ["2026-09-17"] }]
      );
      expect(result).toEqual({
        whereClause: "WHERE date(date) = $1 AND note LIKE $2",
        params: ["2026-09-17", "%kopi%"],
      });
    });

    it("supports extraConditions without params", () => {
      const result = buildWhereClause([], ALLOWED_COLUMNS, [
        { condition: "deleted_at IS NULL" },
      ]);
      expect(result).toEqual({
        whereClause: "WHERE deleted_at IS NULL",
        params: [],
      });
    });
  });

  describe("startIndex", () => {
    it("continues placeholder numbering from startIndex instead of $1", () => {
      const result = buildWhereClause(
        [{ filterKey: "amount", filterOperator: "gt", filterValue: 1000 }],
        ALLOWED_COLUMNS,
        [],
        3
      );
      expect(result).toEqual({
        whereClause: "WHERE amount > $3",
        params: [1000],
      });
    });

    it("keeps subsequent placeholders sequential after startIndex", () => {
      const result = buildWhereClause(
        [
          { filterKey: "note", filterOperator: "ilike", filterValue: "kopi" },
          { filterKey: "amount", filterOperator: "gt", filterValue: 1000 },
        ],
        ALLOWED_COLUMNS,
        [],
        2
      );
      expect(result).toEqual({
        whereClause: "WHERE note LIKE $2 AND amount > $3",
        params: ["%kopi%", 1000],
      });
    });
  });
});
