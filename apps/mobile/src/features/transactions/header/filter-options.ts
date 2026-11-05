import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";

export interface FilterCategoryRow {
  id: string;
  name: string;
  parent_name: string | null;
}

export interface FilterAccountRow {
  id: string;
  name: string;
  is_active: number;
}

// Pilihan tetap sama dengan desktop (list/context/constants.ts). "Label" dan "Sumber Data" belum ada di mobile.
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

// Kategori anak diberi awalan induknya karena nama anak bisa kembar antar induk; akun nonaktif tetap bisa dipilih
// (transaksi lamanya masih ada) dan ditandai.
export function buildTransactionFilterOptions(
  categories: FilterCategoryRow[],
  accounts: FilterAccountRow[]
): SelectOptionsMap {
  return {
    ...STATIC_FILTER_SELECT_OPTIONS,
    category_id: categories.map((category) => ({
      value: category.id,
      label: category.parent_name ? `${category.parent_name} › ${category.name}` : category.name,
    })),
    account_id: accounts.map((account) => ({
      value: account.id,
      label: account.is_active ? account.name : `${account.name} (Nonaktif)`,
    })),
  };
}
