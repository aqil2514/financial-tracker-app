import type { CategoryFormValues } from "./schema";

export function emptyCategoryValues(): CategoryFormValues {
  return {
    name: "",
    type: "expense",
    parent_id: null,
  };
}
