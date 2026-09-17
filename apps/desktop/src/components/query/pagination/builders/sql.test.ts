import { describe, expect, it } from "vitest";
import { buildLimitOffset } from "./sql";

describe("buildLimitOffset", () => {
  it("builds LIMIT/OFFSET starting from index 1 when there are no prior params", () => {
    const result = buildLimitOffset(1, 20, 1);
    expect(result.clause).toBe("LIMIT $1 OFFSET $2");
    expect(result.params).toEqual([20, 0]);
  });

  it("computes offset from page and limit", () => {
    const result = buildLimitOffset(3, 20, 1);
    expect(result.clause).toBe("LIMIT $1 OFFSET $2");
    expect(result.params).toEqual([20, 40]);
  });

  it("continues placeholder numbering from a given startIndex", () => {
    // Simulasikan whereClause yang sudah memakai $1..$3.
    const result = buildLimitOffset(1, 10, 4);
    expect(result.clause).toBe("LIMIT $4 OFFSET $5");
    expect(result.params).toEqual([10, 0]);
  });

  it("returns offset 0 for page 1 regardless of limit", () => {
    expect(buildLimitOffset(1, 50, 1).params[1]).toBe(0);
  });
});
