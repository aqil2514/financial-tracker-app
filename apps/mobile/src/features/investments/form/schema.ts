import { z } from "zod";

export const purchaseFormSchema = z
  .object({
    source: z.enum(["cash", "direct"]),
    cash_account_id: z.string().nullable(),
    amount: z.coerce.number().min(0, "Nominal tidak boleh negatif"),
    unit: z.coerce.number().positive("Jumlah unit harus lebih dari 0").nullable(),
    price_mode: z.enum(["unit", "total"]),
    price_input: z.coerce.number().positive("Harga harus lebih dari 0").nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
    status: z.enum(["pending", "settled"]),
  })
  .superRefine((values, ctx) => {
    if (values.source === "cash") {
      if (!values.cash_account_id) {
        ctx.addIssue({ code: "custom", path: ["cash_account_id"], message: "Akun kas wajib dipilih" });
      }
      if (values.amount <= 0) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Nominal harus lebih dari 0" });
      }
    }

    // Unit/harga boleh kosong HANYA untuk order pending dari kas (belum tahu nilai finalnya).
    const needsFinalValues = values.source === "direct" || values.status === "settled";
    if (needsFinalValues && values.unit == null) {
      ctx.addIssue({ code: "custom", path: ["unit"], message: "Jumlah unit wajib diisi" });
    }
    if (needsFinalValues && values.price_input == null) {
      ctx.addIssue({ code: "custom", path: ["price_input"], message: "Harga wajib diisi" });
    }

    if (values.price_mode === "total" && values.price_input != null && !(values.unit != null && values.unit > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["price_input"],
        message: "Isi jumlah unit dulu untuk menghitung harga per unit dari total",
      });
    }
  });

export type PurchaseFormValues = z.input<typeof purchaseFormSchema>;
export type PurchaseFormOutput = z.output<typeof purchaseFormSchema>;
