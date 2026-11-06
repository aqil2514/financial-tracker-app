import { z } from "zod";

export const labelSchema = z.object({
  name: z.string().trim().min(1, "Nama label wajib diisi"),
  scope: z.enum(["transaction_category", "account"]),
});

export type LabelFormValues = z.input<typeof labelSchema>;
export type LabelFormOutput = z.output<typeof labelSchema>;

export const LABEL_SCOPE_OPTIONS = [
  { value: "transaction_category", label: "Transaksi & Kategori" },
  { value: "account", label: "Akun" },
];

export const LABEL_SCOPE_TEXT: Record<LabelFormOutput["scope"], string> = {
  transaction_category: "Transaksi & Kategori",
  account: "Akun",
};
