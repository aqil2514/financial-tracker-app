import { describe, expect, it } from "vitest";
import { buildOrderClause } from "./sql";

const ALLOWED_COLUMNS = ["date", "amount", "id"] as const;

describe("buildOrderClause", () => {
  it("returns the default clause when sorts is empty", () => {
    expect(buildOrderClause([], ALLOWED_COLUMNS, "date DESC, id DESC")).toBe(
      "ORDER BY date DESC, id DESC"
    );
  });

  it("builds a single-column ORDER BY", () => {
    expect(
      buildOrderClause(
        [{ sortKey: "amount", sortDirection: "asc" }],
        ALLOWED_COLUMNS,
        "date DESC"
      )
    ).toBe("ORDER BY amount ASC");
  });

  it("builds a multi-column ORDER BY, preserving order", () => {
    expect(
      buildOrderClause(
        [
          { sortKey: "amount", sortDirection: "desc" },
          { sortKey: "date", sortDirection: "asc" },
        ],
        ALLOWED_COLUMNS,
        "date DESC"
      )
    ).toBe("ORDER BY amount DESC, date ASC");
  });

  it("throws when sortKey is not in allowedColumns", () => {
    expect(() =>
      buildOrderClause(
        [{ sortKey: "secret_column", sortDirection: "asc" }],
        ALLOWED_COLUMNS,
        "date DESC"
      )
    ).toThrow(/secret_column/);
  });
});
