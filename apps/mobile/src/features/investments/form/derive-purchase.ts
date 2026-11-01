import type { PurchaseFormOutput } from "./schema";

// Yang tersimpan di price_per_unit SELALU harga per unit; mode "total" dibagi unit di sini
// (mode cuma state form, tidak disimpan).
export function computePricePerUnit(
  mode: "unit" | "total",
  priceInput: number | null,
  unit: number | null
): number | null {
  if (priceInput == null) return null;
  return mode === "total" ? priceInput / (unit as number) : priceInput;
}

// Status direct dipaksa settled, akun kas hanya untuk jalur kas.
export function derivePurchase(values: PurchaseFormOutput) {
  return {
    status: values.source === "direct" ? ("settled" as const) : values.status,
    cashAccountId: values.source === "cash" ? values.cash_account_id : null,
    unit: values.unit,
    pricePerUnit: computePricePerUnit(values.price_mode, values.price_input, values.unit),
  };
}
