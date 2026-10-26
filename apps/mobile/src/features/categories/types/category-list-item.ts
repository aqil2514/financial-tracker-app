export interface CategoryListItem {
  id: string;
  name: string;
  type: "income" | "expense";
  parentId: string | null;
  isActive: boolean;
}
