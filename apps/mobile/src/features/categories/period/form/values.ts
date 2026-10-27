import type { CategoryPeriodFormValues } from "./schema";

export function emptyCategoryPeriodValues(): CategoryPeriodFormValues {
  return {
    name: "",
    category_ids: [],
    start_date: new Date().toISOString(),
    end_date: new Date().toISOString(),
  };
}
