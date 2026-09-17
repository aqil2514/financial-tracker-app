import { describe, expect, it } from "vitest";
import { formatDate } from "./format-date";

describe("formatDate", () => {
  it("formats a YYYY-MM string as short month label", () => {
    expect(formatDate("2026-09", "month-label")).toMatch(/Sep/i);
    expect(formatDate("2026-09", "month-label")).toContain("26");
  });

  it("formats a date-only string as date-time", () => {
    expect(formatDate("2026-09-17", "date-time")).toContain("2026");
  });

  it("includes time when the value has a time component", () => {
    expect(formatDate("2026-09-17T14:30", "date-time")).toMatch(/14[.:]30/);
  });
});
