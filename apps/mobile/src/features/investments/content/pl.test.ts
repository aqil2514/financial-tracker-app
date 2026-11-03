import { describe, expect, it } from "vitest";
import { computePl, formatAgo, formatSignedCurrency } from "./pl";

describe("computePl", () => {
  it("untung: pl positif dan persen dari modal", () => {
    const result = computePl(1_100_000, 1_000_000);
    expect(result.pl).toBe(100_000);
    expect(result.percent).toBeCloseTo(10);
    expect(result.toneClass).toBe("text-green-700");
  });

  it("rugi: pl negatif, tone merah", () => {
    expect(computePl(900_000, 1_000_000).toneClass).toBe("text-red-700");
  });

  it("modal 0: persen 0 (tidak membagi nol)", () => {
    expect(computePl(500_000, 0).percent).toBe(0);
  });
});

describe("formatAgo", () => {
  const now = new Date("2026-11-10T12:00:00Z").getTime();

  it("null: tanda strip", () => {
    expect(formatAgo(null, now)).toBe("—");
  });

  it("format SQLite (spasi, UTC) dibaca sebagai UTC, bukan waktu lokal", () => {
    expect(formatAgo("2026-11-10 01:00:00", now)).toBe("Hari ini");
    expect(formatAgo("2026-11-09 11:00:00", now)).toBe("Kemarin");
    expect(formatAgo("2026-11-05 12:00:00", now)).toBe("5 hari lalu");
  });

  it("format ISO dengan T tetap diterima", () => {
    expect(formatAgo("2026-11-07T12:00:00Z", now)).toBe("3 hari lalu");
  });
});

describe("formatSignedCurrency", () => {
  it("tanda di depan simbol Rp, bukan di antara Rp dan angka", () => {
    expect(formatSignedCurrency(500_000)).toBe(`+${formatSignedCurrency(500_000).slice(1)}`);
    expect(formatSignedCurrency(-5_000).startsWith("-Rp")).toBe(true);
    expect(formatSignedCurrency(5_000).startsWith("+Rp")).toBe(true);
  });
});
