import type { PurchaseFormValues } from "./schema";
import { toLocalDateTime } from "@/lib/utils/local-datetime";

export function emptyPurchaseValues(): PurchaseFormValues {
  return {
    source: "cash",
    cash_account_id: null,
    amount: 0,
    unit: null,
    price_mode: "unit",
    price_input: null,
    date: toLocalDateTime(),
    note: "",
    status: "pending",
  };
}
