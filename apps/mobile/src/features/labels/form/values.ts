import type { LabelFormValues } from "./schema";

export function emptyLabelValues(): LabelFormValues {
  return { name: "", scope: "transaction_category" };
}
