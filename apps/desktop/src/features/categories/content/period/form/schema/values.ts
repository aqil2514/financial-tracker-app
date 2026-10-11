import type { CategoryPeriodFormValues } from "./schema";

export function getCategoryPeriodDefaultValues(categoryId: string): CategoryPeriodFormValues {
  return {
    category_id: categoryId,
    name: "",
    date_range: { from: undefined, to: undefined },
  };
}
