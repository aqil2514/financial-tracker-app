import type { CategoryPeriodFormValues } from "./schema";

export function getCategoryPeriodDefaultValues(): CategoryPeriodFormValues {
  return {
    category_ids: [],
    name: "",
    date_range: { from: undefined, to: undefined },
  };
}
