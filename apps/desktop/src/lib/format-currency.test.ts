import { describe, expect, it } from "vitest";
import { formatCurrency } from "./format-currency";

describe("formatCurrency", () => {
  it("formats a positive number as Indonesian Rupiah", () => {
    expect(formatCurrency(150_000, "IDR")).toContain("150.000");
    expect(formatCurrency(150_000, "IDR")).toContain("Rp");
  });

  it("formats zero", () => {
    expect(formatCurrency(0, "IDR")).toContain("0");
  });

  it("formats negative numbers with a minus sign", () => {
    expect(formatCurrency(-50_000, "IDR")).toMatch(/^-/);
    expect(formatCurrency(-50_000, "IDR")).toContain("50.000");
  });

  it("rounds to whole units (no decimals)", () => {
    expect(formatCurrency(1_000.6, "IDR")).toContain("1.001");
    expect(formatCurrency(1_000.6, "IDR")).not.toContain(",");
  });

  it("formats USD using its native locale (comma thousands separator)", () => {
    expect(formatCurrency(1_500, "USD")).toContain("$");
    expect(formatCurrency(1_500, "USD")).toContain("1,500");
  });
});
