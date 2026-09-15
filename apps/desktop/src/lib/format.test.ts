import { describe, expect, it } from "vitest";
import { formatRupiah } from "./format";

describe("formatRupiah", () => {
  it("formats a positive number as Indonesian Rupiah", () => {
    expect(formatRupiah(150_000)).toContain("150.000");
    expect(formatRupiah(150_000)).toContain("Rp");
  });

  it("formats zero", () => {
    expect(formatRupiah(0)).toContain("0");
  });

  it("formats negative numbers with a minus sign", () => {
    expect(formatRupiah(-50_000)).toMatch(/^-/);
    expect(formatRupiah(-50_000)).toContain("50.000");
  });

  it("rounds to whole rupiah (no decimals)", () => {
    expect(formatRupiah(1_000.6)).toContain("1.001");
    expect(formatRupiah(1_000.6)).not.toContain(",");
  });
});
