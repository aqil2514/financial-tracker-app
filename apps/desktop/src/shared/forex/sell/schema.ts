import { z } from "zod";

export const sellForexSchema = z.object({
  cash_account_id: z.string().min(1, "Akun kas wajib dipilih"),
  unit: z.coerce.number().positive("Jumlah harus lebih dari 0"),
  rate: z.coerce.number().positive("Kurs harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().min(1, "Catatan wajib diisi"),
});

export type SellForexFormValues = z.input<typeof sellForexSchema>;
export type SellForexFormOutput = z.output<typeof sellForexSchema>;
