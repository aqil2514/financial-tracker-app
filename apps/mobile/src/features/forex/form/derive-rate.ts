import { rateFromTotal } from "@/shared/forex/forex-rate-math";

// Yang tersimpan SELALU kurs per unit. Mode "total" dibagi jumlah unit di sini; null kalau tidak bisa dihitung.
export function deriveRate(mode: "rate" | "total", rateInput: number, unit: number): number | null {
  return mode === "total" ? rateFromTotal(rateInput, unit) : rateInput;
}
