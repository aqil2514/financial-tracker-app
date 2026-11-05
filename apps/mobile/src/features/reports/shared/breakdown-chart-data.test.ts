import { describe, expect, it } from "vitest";
import { BREAKDOWN_COLORS, toBreakdownChartData } from "./breakdown-chart-data";

describe("toBreakdownChartData", () => {
  it("menghitung total dan persentase tiap baris", () => {
    const { total, rows } = toBreakdownChartData([
      { group_key: "a", label: "A", total: 750 },
      { group_key: "b", label: "B", total: 250 },
    ]);
    expect(total).toBe(1000);
    expect(rows.map((r) => r.percent)).toEqual([75, 25]);
  });

  it("warna berputar kembali ke awal setelah palet habis", () => {
    const input = Array.from({ length: BREAKDOWN_COLORS.length + 1 }, (_, i) => ({
      group_key: String(i),
      label: String(i),
      total: 1,
    }));
    const { rows } = toBreakdownChartData(input);
    expect(rows[BREAKDOWN_COLORS.length].color).toBe(BREAKDOWN_COLORS[0]);
  });

  it("memakai palet kustom kalau diberikan", () => {
    const { rows } = toBreakdownChartData([{ group_key: "a", label: "A", total: 1 }], ["#000000"]);
    expect(rows[0].color).toBe("#000000");
  });

  it("tanpa data: total 0 dan tidak ada pembagian dengan nol", () => {
    expect(toBreakdownChartData([])).toEqual({ total: 0, rows: [] });
    expect(toBreakdownChartData([{ group_key: null, label: "X", total: 0 }]).rows[0].percent).toBe(0);
  });

  it("baris tambahan dari pemanggil ikut terbawa", () => {
    const { rows } = toBreakdownChartData([{ group_key: "a", label: "A", total: 1, extra: 9 }]);
    expect(rows[0].extra).toBe(9);
  });
});
