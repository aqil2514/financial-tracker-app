import { describe, expect, it } from "vitest";
import { formatNumberCompact, formatCompactNotation } from "./format";

describe("formatNumberCompact", () => {
  it("formats a positive number without currency symbol", () => {
    expect(formatNumberCompact(150_000)).toBe("150.000");
  });

  it("rounds to whole numbers", () => {
    expect(formatNumberCompact(1_000.6)).toBe("1.001");
  });
});

describe("formatCompactNotation", () => {
  it("shortens large numbers using compact notation", () => {
    expect(formatCompactNotation(1_200_000)).toContain("jt");
  });

  it("leaves small numbers unshortened", () => {
    expect(formatCompactNotation(500)).toBe("500");
  });
});
