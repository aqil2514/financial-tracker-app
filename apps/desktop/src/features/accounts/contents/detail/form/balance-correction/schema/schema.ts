import { z } from "zod";

export const accountBalanceCorrectionSchema = z.object({
  targetBalance: z.coerce.number(),
  countAsCash: z.boolean().default(true),
});

export type AccountBalanceCorrectionFormValues = z.input<typeof accountBalanceCorrectionSchema>;
export type AccountBalanceCorrectionFormOutput = z.output<typeof accountBalanceCorrectionSchema>;
