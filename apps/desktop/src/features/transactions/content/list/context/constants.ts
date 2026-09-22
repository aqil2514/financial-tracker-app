import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";

export const STATIC_FILTER_SELECT_OPTIONS: SelectOptionsMap = {
  type: [
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    { value: "transfer", label: "Transfer" },
  ],
  has_attachment: [
    { value: "1", label: "Ada gambar" },
    { value: "0", label: "Tidak ada gambar" },
  ],
};
