import { describe, expect, it } from "vitest";
import {
  buildMonotonePath,
  buildMonotoneSegments,
  computeYTicks,
  cumulativeLengths,
  pickLabelIndexes,
} from "./line-chart-geometry";

describe("computeYTicks", () => {
  it("mulai dari 0 dan berakhir di kelipatan bagus yang melewati max", () => {
    expect(computeYTicks(1_060_000)).toEqual([0, 500_000, 1_000_000, 1_500_000]);
    expect(computeYTicks(260_000)).toEqual([0, 100_000, 200_000, 300_000]);
    expect(computeYTicks(7)).toEqual([0, 2, 4, 6, 8]);
  });

  it("max tidak valid memberi sumbu default", () => {
    expect(computeYTicks(0)).toEqual([0, 1]);
    expect(computeYTicks(NaN)).toEqual([0, 1]);
  });
});

describe("buildMonotonePath", () => {
  it("kosong, satu titik, dan dua titik", () => {
    expect(buildMonotonePath([])).toBe("");
    expect(buildMonotonePath([{ x: 5, y: 7 }])).toBe("M 5 7");
    expect(buildMonotonePath([{ x: 0, y: 0 }, { x: 30, y: 30 }])).toBe("M 0 0 C 10 10 20 20 30 30");
  });

  it("tidak overshoot: titik kontrol di antara dua titik data datar tetap datar", () => {
    const path = buildMonotonePath([
      { x: 0, y: 100 },
      { x: 30, y: 100 },
      { x: 60, y: 40 },
    ]);
    // segmen pertama (antara dua titik sama tinggi) harus tetap horizontal di y=100
    expect(path.startsWith("M 0 100 C 10 100 20 100 30 100")).toBe(true);
  });

  it("jumlah segmen = jumlah titik - 1", () => {
    const path = buildMonotonePath([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 5 },
      { x: 30, y: 15 },
    ]);
    expect(path.match(/C/g)).toHaveLength(3);
  });
});

describe("cumulativeLengths", () => {
  it("garis lurus: panjang kumulatif sama dengan jarak antar titik", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: 60, y: 80 },
    ];
    const cumulative = cumulativeLengths(buildMonotoneSegments(points), points.length);
    expect(cumulative[0]).toBe(0);
    expect(cumulative[1]).toBeCloseTo(50, 3);
    expect(cumulative[2]).toBeCloseTo(100, 3);
  });

  it("satu titik: panjang 0 dan tidak ada segmen", () => {
    expect(buildMonotoneSegments([{ x: 1, y: 1 }])).toEqual([]);
    expect(cumulativeLengths([], 1)).toEqual([0]);
  });

  it("kurva lebih panjang dari jarak lurus antar ujungnya", () => {
    const points = [
      { x: 0, y: 100 },
      { x: 50, y: 0 },
      { x: 100, y: 100 },
    ];
    const cumulative = cumulativeLengths(buildMonotoneSegments(points), points.length);
    expect(cumulative[2]).toBeGreaterThan(100);
  });
});

describe("pickLabelIndexes", () => {
  it("menyaring sampai maksimal maxLabels dan selalu memuat indeks 0", () => {
    expect(pickLabelIndexes(3, 5)).toEqual([0, 1, 2]);
    const indexes = pickLabelIndexes(30, 5);
    expect(indexes[0]).toBe(0);
    expect(indexes.length).toBeLessThanOrEqual(5);
  });

  it("tanpa titik: tanpa label", () => {
    expect(pickLabelIndexes(0, 5)).toEqual([]);
  });
});
