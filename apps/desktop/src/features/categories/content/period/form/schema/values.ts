import type { CategoryPeriod } from "@/lib/db";
import type { CategoryPeriodFormValues } from "./schema";

export function getCategoryPeriodDefaultValues(): CategoryPeriodFormValues {
  return {
    category_ids: [],
    name: "",
    date_range: { from: undefined, to: undefined },
  };
}

export function getCategoryPeriodEditValues(
  period: CategoryPeriod,
  categoryIds: string[]
): CategoryPeriodFormValues {
  return {
    category_ids: categoryIds,
    name: period.name,
    date_range: {
      from: new Date(period.start_date),
      to: new Date(period.end_date),
    },
  };
}
