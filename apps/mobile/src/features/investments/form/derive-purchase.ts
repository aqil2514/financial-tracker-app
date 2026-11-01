import type { PurchaseFormOutput } from "./schema";

// Yang tersimpan di price_per_unit SELALU harga per unit; mode "total" dibagi unit di sini
// (mode cuma state form, tidak disimpan). Status direct dipaksa settled, akun kas hanya untuk jalur kas.
export function derivePurchase(values: PurchaseFormOutput) {
  const pricePerUnit =
    values.price_input == null
      ? null
      : values.price_mode === "total"
        ? values.price_input / (values.unit as number)
        : values.price_input;

  return {
    status: values.source === "direct" ? ("settled" as const) : values.status,
    cashAccountId: values.source === "cash" ? values.cash_account_id : null,
    unit: values.unit,
    pricePerUnit,
  };
}
