import { describe, expect, it } from "vitest";
import { rateFromTotal, totalFromRate } from "./forex-rate-math";

describe("rateFromTotal", () => {
  it("nilai total dibagi unit, dibulatkan 6 desimal", () => {
    expect(rateFromTotal(541_110, 30)).toBe(18_037);
    expect(rateFromTotal(100, 3)).toBe(33.333333);
  });

  it("menolak unit nol, total negatif, dan bukan angka", () => {
    expect(rateFromTotal(100, 0)).toBeNull();
    expect(rateFromTotal(-1, 10)).toBeNull();
    expect(rateFromTotal(Number.NaN, 10)).toBeNull();
  });
});

describe("totalFromRate", () => {
  it("kurs × unit dibulatkan 2 desimal", () => {
    expect(totalFromRate(18_037, 30)).toBe(541_110);
    expect(totalFromRate(33.333333, 3)).toBe(100);
  });
});
