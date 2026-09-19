import { z } from "zod";

export const accountBalanceCorrectionSchema = z.object({
  targetBalance: z.coerce.number(),
});

export type AccountBalanceCorrectionFormValues = z.input<typeof accountBalanceCorrectionSchema>;
export type AccountBalanceCorrectionFormOutput = z.output<typeof accountBalanceCorrectionSchema>;
