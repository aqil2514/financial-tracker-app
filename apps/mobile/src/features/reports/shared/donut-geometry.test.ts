import { describe, expect, it } from "vitest";
import { computeSlices, describeSector } from "./donut-geometry";

describe("computeSlices", () => {
  it("membagi 360° sesuai proporsi, dikurangi sela antar irisan", () => {
    const [a, b] = computeSlices([75, 25], 1, 2);
    expect(a).toEqual({ startAngle: 1, endAngle: 269 });
    expect(b).toEqual({ startAngle: 271, endAngle: 359 });
  });

  it("satu irisan: tanpa sela, menutup 360° penuh", () => {
    expect(computeSlices([100], 1)).toEqual([{ startAngle: 0, endAngle: 360 }]);
  });

  it("progress menskalakan semua sudut, 0 = belum ada irisan", () => {
    const [half] = computeSlices([100], 0.5);
    expect(half.endAngle).toBe(180);
    const [zero] = computeSlices([100], 0);
    expect(zero.endAngle - zero.startAngle).toBe(0);
  });

  it("tanpa nilai positif: tidak ada irisan", () => {
    expect(computeSlices([], 1)).toEqual([]);
    expect(computeSlices([0, 0], 1)).toEqual([]);
  });
});

describe("describeSector", () => {
  it("irisan biasa menghasilkan satu path", () => {
    expect(describeSector(50, 50, 20, 40, 0, 90)).toHaveLength(1);
  });

  it("lingkaran penuh dipecah jadi dua setengah lingkaran", () => {
    expect(describeSector(50, 50, 20, 40, 0, 360)).toHaveLength(2);
  });

  it("irisan nyaris nol (awal animasi) tidak digambar", () => {
    expect(describeSector(50, 50, 20, 40, 0, 0)).toEqual([]);
  });

  it("titik awal busur luar ada di jam 12 untuk sudut 0", () => {
    const [path] = describeSector(50, 50, 20, 40, 0, 90);
    expect(path.startsWith("M 50 10")).toBe(true);
  });
});
