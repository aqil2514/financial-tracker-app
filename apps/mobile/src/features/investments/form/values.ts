import type { PurchaseFormValues } from "./schema";

export function emptyPurchaseValues(): PurchaseFormValues {
  return {
    source: "cash",
    cash_account_id: null,
    amount: 0,
    unit: null,
    price_mode: "unit",
    price_input: null,
    date: new Date().toISOString(),
    note: "",
    status: "pending",
  };
}
