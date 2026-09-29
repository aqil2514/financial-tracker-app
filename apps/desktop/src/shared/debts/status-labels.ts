/** Label & variant Badge untuk `debts.status` — dipakai DebtListTable
 * (features/debts/) dan dialog detail kontak
 * (features/debts-summary/content/card/detail/), diekstrak ke sini
 * supaya tidak terduplikasi persis di kedua tempat. */
export const DEBT_STATUS_LABEL: Record<string, string> = {
  ongoing: "Berjalan",
  paid: "Lunas",
  written_off: "Dihapuskan",
};

export const DEBT_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ongoing: "default",
  paid: "secondary",
  written_off: "outline",
};
