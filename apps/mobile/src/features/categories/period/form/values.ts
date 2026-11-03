import type { CategoryPeriodFormValues } from "./schema";
import { toLocalDate } from "@/lib/utils/local-datetime";

export function emptyCategoryPeriodValues(): CategoryPeriodFormValues {
  return {
    name: "",
    category_ids: [],
    start_date: toLocalDate(),
    end_date: toLocalDate(),
  };
}
