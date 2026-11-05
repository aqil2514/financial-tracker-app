import { describe, expect, it } from "vitest";
import { formatCurrency, formatCurrencyPrecise } from "./format-currency";

describe("formatCurrency", () => {
  it("membulatkan ke rupiah penuh dengan pemisah ribuan", () => {
    expect(formatCurrency(11728459.373)).toBe("Rp11.728.459");
    expect(formatCurrency(11728459.573)).toBe("Rp11.728.460");
    expect(formatCurrency(23890776.82)).toBe("Rp23.890.777");
  });

  it("menulis tanda minus sebelum Rp", () => {
    expect(formatCurrency(-12162317.2)).toBe("-Rp12.162.317");
  });

  it("tidak menghasilkan -Rp0 untuk nilai negatif sangat kecil", () => {
    expect(formatCurrency(-0.4)).toBe("Rp0");
  });
});

describe("formatCurrencyPrecise", () => {
  it("mempertahankan sampai 2 desimal dan tidak menambah nol di belakang", () => {
    expect(formatCurrencyPrecise(1234.5)).toBe("Rp1.234,5");
    expect(formatCurrencyPrecise(1234.567)).toBe("Rp1.234,57");
    expect(formatCurrencyPrecise(1000)).toBe("Rp1.000");
  });
});
