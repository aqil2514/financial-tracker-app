import { z } from "zod";

export const newInvestmentPurchaseSchema = z
  .object({
    cash_account_id: z.string().min(1, "Akun kas wajib dipilih"),
    investment_account_id: z.string().min(1, "Akun investasi wajib dipilih"),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    // OPSIONAL kalau status 'pending' (order beli yang masih diproses,
    // mis. reksadana, belum tahu unit pastinya sampai settlement
    // dikonfirmasi) -- tapi WAJIB kalau user langsung pilih 'settled' saat
    // mencatat (nilainya sudah pasti saat itu juga, tidak ada alasan
    // dikosongkan). Lihat superRefine di bawah + apply-investment-transaction.ts.
    unit: z.coerce.number().positive("Jumlah unit harus lebih dari 0").nullable(),
    price_per_unit: z.coerce.number().positive("Harga per unit harus lebih dari 0").nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
    status: z.enum(["pending", "settled"]),
  })
  .superRefine((values, ctx) => {
    if (values.status === "settled") {
      if (values.unit == null) {
        ctx.addIssue({
          code: "custom",
          path: ["unit"],
          message: "Jumlah unit wajib diisi untuk status Settled",
        });
      }
      if (values.price_per_unit == null) {
        ctx.addIssue({
          code: "custom",
          path: ["price_per_unit"],
          message: "Harga per unit wajib diisi untuk status Settled",
        });
      }
    }
  });

export type NewInvestmentPurchaseFormValues = z.input<typeof newInvestmentPurchaseSchema>;
export type NewInvestmentPurchaseFormOutput = z.output<typeof newInvestmentPurchaseSchema>;
