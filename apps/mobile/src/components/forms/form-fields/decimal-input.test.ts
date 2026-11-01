import { describe, expect, it } from "vitest";
import { formatDecimalDisplay, parseDecimalInput } from "./decimal-input";

describe("parseDecimalInput (grouped)", () => {
  it("titik ribuan dibuang, hasil memakai titik desimal", () => {
    expect(parseDecimalInput("1.234.567", true)).toBe("1234567");
    expect(parseDecimalInput("1.234,5", true)).toBe("1234.5");
  });

  it("koma di ujung dipertahankan supaya user bisa lanjut mengetik pecahan", () => {
    expect(parseDecimalInput("12,", true)).toBe("12.");
  });

  it("titik yang baru diketik di ujung dianggap pemisah desimal (keyboard tanpa koma)", () => {
    expect(parseDecimalInput("1.250.", true)).toBe("1250.");
    expect(parseDecimalInput("5.", true)).toBe("5.");
  });

  it("titik di ujung TIDAK diubah jadi desimal kalau sudah ada koma", () => {
    expect(parseDecimalInput("1,5.", true)).toBe("1.5");
  });

  it("hanya satu pemisah desimal, karakter lain dibuang", () => {
    expect(parseDecimalInput("1,2,3abc", true)).toBe("1.23");
  });

  it("diawali koma: bagian bulat jadi 0; nol di depan dibuang", () => {
    expect(parseDecimalInput(",5", true)).toBe("0.5");
    expect(parseDecimalInput("007", true)).toBe("7");
    expect(parseDecimalInput("0", true)).toBe("0");
  });

  it("kosong tetap kosong", () => {
    expect(parseDecimalInput("", true)).toBe("");
  });
});

describe("parseDecimalInput (tanpa grouping)", () => {
  it("titik dan koma sama-sama jadi desimal", () => {
    expect(parseDecimalInput("1.25", false)).toBe("1.25");
    expect(parseDecimalInput("1,25", false)).toBe("1.25");
  });
});

describe("formatDecimalDisplay", () => {
  it("grouped: ribuan pakai titik, desimal pakai koma", () => {
    expect(formatDecimalDisplay("1234567", true)).toBe("1.234.567");
    expect(formatDecimalDisplay("1234.5", true)).toBe("1.234,5");
    expect(formatDecimalDisplay("1000000.", true)).toBe("1.000.000,");
    expect(formatDecimalDisplay("999", true)).toBe("999");
  });

  it("tanpa grouping: hanya koma desimal", () => {
    expect(formatDecimalDisplay("1234.5", false)).toBe("1234,5");
  });

  it("kosong tetap kosong", () => {
    expect(formatDecimalDisplay("", true)).toBe("");
  });

  it("round-trip: ketik lalu tampil lalu parse kembali konsisten", () => {
    const displayed = formatDecimalDisplay(parseDecimalInput("1250000,75", true), true);
    expect(displayed).toBe("1.250.000,75");
    expect(parseDecimalInput(displayed, true)).toBe("1250000.75");
  });
});
