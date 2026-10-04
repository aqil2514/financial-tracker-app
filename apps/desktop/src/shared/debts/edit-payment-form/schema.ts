import { z } from "zod";

export const editPaymentSchema = z.object({
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string(),
});

export type EditPaymentFormValues = z.input<typeof editPaymentSchema>;
export type EditPaymentFormOutput = z.output<typeof editPaymentSchema>;
