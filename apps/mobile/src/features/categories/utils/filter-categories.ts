import { CategoryListItem } from "../types";

export type CategoryTypeFilter = "all" | "income" | "expense";
export type CategoryStatusFilter = "all" | "active" | "inactive";

export interface CategoryFilterState {
  search: string;
  type: CategoryTypeFilter;
  status: CategoryStatusFilter;
}

export const defaultCategoryFilter: CategoryFilterState = {
  search: "",
  type: "all",
  status: "all",
};

function matchesOwnFilter(category: CategoryListItem, filter: CategoryFilterState): boolean {
  if (filter.type !== "all" && category.type !== filter.type) return false;
  if (filter.status === "active" && !category.isActive) return false;
  if (filter.status === "inactive" && category.isActive) return false;
  if (filter.search && !category.name.toLowerCase().includes(filter.search.toLowerCase())) {
    return false;
  }
  return true;
}

// Beda dari filter SQL WHERE biasa (yang cuma cocokkan baris satu-satu):
// kalau kategori INDUK match filter, semua anak langsungnya tetap
// diikutkan walau nama anaknya sendiri tidak match search — supaya
// grouping accordion tidak kelihatan "bolong" tanpa alasan jelas bagi
// pengguna. Begitu juga sebaliknya: anak yang match tetap membawa
// induknya walau induk sendiri tidak match, biar section-nya tetap ada
// tempat bernaung (sama seperti logic grouping desktop).
export function filterCategories(
  categories: CategoryListItem[],
  filter: CategoryFilterState
): CategoryListItem[] {
  if (filter.search === "" && filter.type === "all" && filter.status === "all") {
    return categories;
  }

  const matchedIds = new Set<string>();

  for (const category of categories) {
    if (!matchesOwnFilter(category, filter)) continue;
    matchedIds.add(category.id);

    if (category.parentId != null) {
      matchedIds.add(category.parentId);
    } else {
      for (const other of categories) {
        if (other.parentId === category.id) matchedIds.add(other.id);
      }
    }
  }

  return categories.filter((category) => matchedIds.has(category.id));
}
