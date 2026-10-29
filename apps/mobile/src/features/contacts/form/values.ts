import type { ContactFormValues } from "./schema";

export function emptyContactValues(): ContactFormValues {
  return {
    name: "",
    note: null,
  };
}
