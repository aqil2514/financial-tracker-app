import { describe, expect, it } from "vitest";
import { toLocalDate, toLocalDateTime } from "./local-datetime";

describe("local-datetime", () => {
  it("memformat waktu lokal tanpa zona dan tanpa detik", () => {
    expect(toLocalDateTime(new Date(2026, 10, 4, 5, 7, 59))).toBe("2026-11-04T05:07");
  });

  it("memformat tanggal saja", () => {
    expect(toLocalDate(new Date(2026, 0, 9, 23, 59))).toBe("2026-01-09");
  });

  it("round-trip lewat new Date() tetap waktu lokal yang sama", () => {
    const stored = toLocalDateTime(new Date(2026, 10, 4, 17, 30));
    const parsed = new Date(stored);
    expect([parsed.getHours(), parsed.getMinutes()]).toEqual([17, 30]);
  });
});
