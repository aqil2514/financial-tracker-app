import type { LabelScope } from "./types";

export const SCOPE_OPTIONS: { value: LabelScope; label: string }[] = [
  { value: "transaction_category", label: "Transaksi & Kategori" },
  { value: "account", label: "Akun" },
];

export const SCOPE_LABEL: Record<LabelScope, string> = {
  transaction_category: "Transaksi & Kategori",
  account: "Akun",
};
