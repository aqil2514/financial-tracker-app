import { describe, expect, it } from "vitest";
import { monthDateRange, shiftMonth } from "./month";

describe("shiftMonth", () => {
  it("melewati batas tahun", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("monthDateRange", () => {
  it("awal sampai akhir bulan, termasuk Februari kabisat", () => {
    expect(monthDateRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthDateRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});
