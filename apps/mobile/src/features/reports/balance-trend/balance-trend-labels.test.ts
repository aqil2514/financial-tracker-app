import { describe, expect, it } from "vitest";
import { formatPointLabel, formatPointTooltip } from "./balance-trend-labels";

describe("formatPointLabel", () => {
  it("memformat label sumbu-X per granularitas", () => {
    expect(formatPointLabel("2026-10-05", "day")).toBe("05 Okt");
    expect(formatPointLabel("2026-10", "month")).toBe("Okt 26");
    expect(formatPointLabel("2026", "year")).toBe("2026");
    expect(formatPointLabel("2026-40", "week")).toBe("M40 '26");
  });
});

describe("formatPointTooltip", () => {
  it("memformat label tooltip lengkap per granularitas", () => {
    expect(formatPointTooltip("2026-10-05", "day")).toBe("5 Okt 2026");
    expect(formatPointTooltip("2026-10", "month")).toBe("Oktober 2026");
    expect(formatPointTooltip("2026", "year")).toBe("2026");
    expect(formatPointTooltip("2026-04", "week")).toBe("Minggu 4, 2026");
  });
});
