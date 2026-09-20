import { z } from "zod";

export const payDebtSchema = z.object({
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  cash_account_id: z.string().min(1, "Akun kas wajib dipilih"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().min(1, "Catatan wajib diisi"),
});

export type PayDebtFormValues = z.input<typeof payDebtSchema>;
export type PayDebtFormOutput = z.output<typeof payDebtSchema>;
