import { describe, expect, it } from "vitest";
import { rateFromTotal, totalFromRate } from "./forex-rate-math";

describe("konversi kurs <-> nilai total", () => {
  it("nilai IDR dari layar BCA menjadi kurs per unit (541.110 / 30 USD)", () => {
    expect(rateFromTotal(541110, 30)).toBe(18037);
  });

  it("bolak-balik tidak menggeser total walau kurs tidak bulat", () => {
    const rate = rateFromTotal(541110, 29.7) as number;
    expect(totalFromRate(rate, 29.7)).toBeCloseTo(541110, 1);
  });

  it("menolak unit nol atau total tidak valid", () => {
    expect(rateFromTotal(1000, 0)).toBeNull();
    expect(rateFromTotal(-1, 10)).toBeNull();
    expect(rateFromTotal(Number.NaN, 10)).toBeNull();
  });

  it("totalFromRate dibulatkan ke 2 desimal", () => {
    expect(totalFromRate(16250.5, 2.25)).toBe(36563.63);
  });
});
