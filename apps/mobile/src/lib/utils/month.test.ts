import { describe, expect, it } from "vitest";
import { formatShortDate, monthDateRange, shiftMonth, subtractMonths } from "./month";

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

describe("formatShortDate", () => {
  it("memformat tanggal kalender polos tanpa pergeseran zona waktu", () => {
    expect(formatShortDate("2026-11-04")).toBe("4 Nov 2026");
    expect(formatShortDate("2026-01-31")).toBe("31 Jan 2026");
  });
});

describe("subtractMonths", () => {
  it("mundur beberapa bulan, termasuk lintas tahun", () => {
    expect(subtractMonths("2026-11-05", 1)).toBe("2026-10-05");
    expect(subtractMonths("2026-02-10", 3)).toBe("2025-11-10");
    expect(subtractMonths("2026-11-05", 12)).toBe("2025-11-05");
  });

  it("hari dijepit ke akhir bulan tujuan", () => {
    expect(subtractMonths("2026-03-31", 1)).toBe("2026-02-28");
    expect(subtractMonths("2028-03-31", 1)).toBe("2028-02-29");
  });
});
