import { describe, expect, it } from "vitest";

import { EFFECTIVE_LABELS_SUBQUERY, splitEffectiveLabels } from "./interface";

describe("EFFECTIVE_LABELS_SUBQUERY delimiter", () => {
  // Bug nyata 2026-10-10: ekstraksi manual teks source (regex) sempat
  // membuat delimiter terlihat kosong ("${LABEL_DELIMITER}" literal,
  // bukan karakter U+001F sungguhan) krn template literal TypeScript
  // HARUS dievaluasi runtime, tidak bisa dibaca dari teks source mentah.
  // Test ini menjalankan MODUL SUNGGUHAN (bukan ekstraksi teks) supaya
  // tidak mengulang kesalahan yang sama -- memverifikasi delimiter yang
  // BENAR-BENAR dipakai saat SQL ini jalan di SQLite.
  it("mengandung karakter unit separator (U+001F), bukan placeholder literal", () => {
    expect(EFFECTIVE_LABELS_SUBQUERY).toContain("");
    expect(EFFECTIVE_LABELS_SUBQUERY).not.toContain("${LABEL_DELIMITER}");
    expect(EFFECTIVE_LABELS_SUBQUERY).not.toContain("GROUP_CONCAT(l.name, '')");
  });
});

describe("splitEffectiveLabels", () => {
  it("null -> array kosong", () => {
    expect(splitEffectiveLabels(null)).toEqual([]);
  });

  it("string kosong -> array kosong", () => {
    expect(splitEffectiveLabels("")).toEqual([]);
  });

  it("satu label -> array 1 item", () => {
    expect(splitEffectiveLabels("Konsumtif")).toEqual(["Konsumtif"]);
  });

  it("banyak label (delimiter asli, bukan koma) -> terpisah benar, termasuk nama yang mengandung koma", () => {
    const joined = ["Beli, Jual", "Produktif"].join("");
    expect(splitEffectiveLabels(joined)).toEqual(["Beli, Jual", "Produktif"]);
  });
});
