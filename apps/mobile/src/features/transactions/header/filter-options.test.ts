import { describe, expect, it } from "vitest";
import { buildTransactionFilterOptions } from "./filter-options";

describe("buildTransactionFilterOptions", () => {
  const options = buildTransactionFilterOptions(
    [
      { id: "c1", name: "Makanan", parent_name: null },
      { id: "c2", name: "Lainnya", parent_name: "Makanan" },
      { id: "c3", name: "Lainnya", parent_name: "Transport" },
    ],
    [
      { id: "a1", name: "Dompet Bebas", is_active: 1 },
      { id: "a2", name: "Rekening Lama", is_active: 0 },
    ]
  );

  it("Tipe dan Gambar memakai pilihan tetap dengan nilai yang cocok ke kolom", () => {
    expect(options.type.map((o) => o.value)).toEqual(["income", "expense", "transfer"]);
    expect(options.has_attachment).toEqual([
      { value: "1", label: "Ada gambar" },
      { value: "0", label: "Tidak ada gambar" },
    ]);
  });

  it("kategori anak diberi awalan induk supaya nama kembar bisa dibedakan", () => {
    expect(options.category_id).toEqual([
      { value: "c1", label: "Makanan" },
      { value: "c2", label: "Makanan › Lainnya" },
      { value: "c3", label: "Transport › Lainnya" },
    ]);
  });

  it("akun nonaktif tetap bisa dipilih dan ditandai", () => {
    expect(options.account_id).toEqual([
      { value: "a1", label: "Dompet Bebas" },
      { value: "a2", label: "Rekening Lama (Nonaktif)" },
    ]);
  });
});
