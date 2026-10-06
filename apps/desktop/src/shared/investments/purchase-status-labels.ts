/** Label & variant Badge untuk `investment_purchases.status` — pola sama
 * `shared/debts/status-labels.ts`. Lihat docs/concept/konsep-investasi.md
 * bagian "Settlement tertunda". */
export const PURCHASE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  settled: "Settled",
};

export const PURCHASE_STATUS_VARIANT: Record<string, "default" | "secondary"> = {
  pending: "secondary",
  settled: "default",
};
