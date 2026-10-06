import { z } from "zod";

export const updateMarketValueSchema = z.object({
  current_market_value: z.coerce.number().min(0, "Nilai pasar tidak boleh negatif"),
});

export type UpdateMarketValueFormValues = z.input<typeof updateMarketValueSchema>;
export type UpdateMarketValueFormOutput = z.output<typeof updateMarketValueSchema>;
