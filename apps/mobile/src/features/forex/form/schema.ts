import { z } from "zod";

const unitField = z.coerce.number().positive("Jumlah harus lebih dari 0");
const rateInputField = z.coerce.number().positive("Nilai harus lebih dari 0");
// "unit" = kurs per unit; "total" = nilai total rupiah (angka "Nilai IDR" di aplikasi bank). Mode hanya state form.
const rateModeField = z.enum(["rate", "total"]);

export const forexPurchaseFormSchema = z
  .object({
    source: z.enum(["cash", "direct"]),
    cash_account_id: z.string().nullable(),
    unit: unitField,
    rate_mode: rateModeField,
    rate_input: rateInputField,
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
  })
  .superRefine((values, ctx) => {
    if (values.source === "cash" && !values.cash_account_id) {
      ctx.addIssue({ code: "custom", path: ["cash_account_id"], message: "Akun kas wajib dipilih" });
    }
  });

export type ForexPurchaseFormValues = z.input<typeof forexPurchaseFormSchema>;
export type ForexPurchaseFormOutput = z.output<typeof forexPurchaseFormSchema>;

export const forexSellFormSchema = z.object({
  cash_account_id: z.string().min(1, "Akun kas wajib dipilih"),
  unit: unitField,
  rate_mode: rateModeField,
  rate_input: rateInputField,
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().min(1, "Catatan wajib diisi"),
});

export type ForexSellFormValues = z.input<typeof forexSellFormSchema>;
export type ForexSellFormOutput = z.output<typeof forexSellFormSchema>;

export const forexRateFormSchema = z.object({
  rate_mode: rateModeField,
  rate_input: rateInputField,
});

export type ForexRateFormValues = z.input<typeof forexRateFormSchema>;
export type ForexRateFormOutput = z.output<typeof forexRateFormSchema>;
