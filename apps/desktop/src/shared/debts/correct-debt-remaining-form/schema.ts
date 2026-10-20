import { z } from "zod";

export const correctDebtRemainingSchema = z.object({
  targetRemaining: z.coerce.number().min(0, "Sisa tidak boleh negatif"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().min(1, "Catatan wajib diisi"),
});

export type CorrectDebtRemainingFormValues = z.input<typeof correctDebtRemainingSchema>;
export type CorrectDebtRemainingFormOutput = z.output<typeof correctDebtRemainingSchema>;
