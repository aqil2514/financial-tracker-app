import { CategoryListItem } from "../types";

export interface CategorySection {
  id: string;
  // Id kategori asli buat section ini, null kalau section "orphans" (anak
  // yang induknya sudah tidak ada) — section itu bukan representasi satu
  // baris kategori, jadi tidak boleh di-toggle aktif/nonaktif.
  categoryId: string | null;
  title: string;
  type: "income" | "expense";
  isActive: boolean;
  isStandalone: boolean;
  data: CategoryListItem[];
}

export function groupByParent(categories: CategoryListItem[]): CategorySection[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  const childrenByParent = new Map<string, CategoryListItem[]>();
  for (const category of categories) {
    if (category.parentId == null) continue;
    const existing = childrenByParent.get(category.parentId) ?? [];
    existing.push(category);
    childrenByParent.set(category.parentId, existing);
  }

  const sections: CategorySection[] = [];
  for (const category of categories) {
    if (category.parentId != null) continue; // sudah ditangani lewat childrenByParent
    const children = childrenByParent.get(category.id) ?? [];
    sections.push({
      id: category.id,
      categoryId: category.id,
      title: category.name,
      type: category.type,
      isActive: category.isActive,
      isStandalone: children.length === 0,
      data: children.length > 0 ? children : [category],
    });
  }

  for (const [parentId, children] of childrenByParent) {
    if (byId.has(parentId)) continue;
    sections.push({
      id: `orphans-${parentId}`,
      categoryId: null,
      title: "Lainnya",
      type: children[0].type,
      isActive: true,
      isStandalone: false,
      data: children,
    });
  }

  return sections;
}
