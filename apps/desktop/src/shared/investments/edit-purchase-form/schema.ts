import { z } from "zod";

export const editInvestmentPurchaseSchema = z.object({
  unit: z.coerce.number().positive("Jumlah unit harus lebih dari 0").nullable(),
  price_per_unit: z.coerce.number().positive("Harga per unit harus lebih dari 0").nullable(),
  status: z.enum(["pending", "settled"]),
});

export type EditInvestmentPurchaseFormValues = z.input<typeof editInvestmentPurchaseSchema>;
export type EditInvestmentPurchaseFormOutput = z.output<typeof editInvestmentPurchaseSchema>;
