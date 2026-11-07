import { z } from "zod";

export const newForexPurchaseSchema = z
  .object({
    source: z.enum(["cash", "direct"]),
    cash_account_id: z.string().nullable(),
    unit: z.coerce.number().positive("Jumlah harus lebih dari 0"),
    rate: z.coerce.number().positive("Kurs harus lebih dari 0"),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
  })
  .superRefine((values, ctx) => {
    if (values.source === "cash" && !values.cash_account_id) {
      ctx.addIssue({ code: "custom", path: ["cash_account_id"], message: "Akun kas wajib dipilih" });
    }
  });

export type NewForexPurchaseFormValues = z.input<typeof newForexPurchaseSchema>;
export type NewForexPurchaseFormOutput = z.output<typeof newForexPurchaseSchema>;
