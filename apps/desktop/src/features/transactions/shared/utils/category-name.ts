import type { Category } from "@/lib/db";

export function categoryName(
  categories: Category[] | undefined,
  id: string | null
): string | null {
  return categories?.find((category) => category.id === id)?.name ?? null;
}
