import { z } from "zod";

import type { AccountType } from "@/lib/account-types";

const cashBalanceCorrectionSchema = z.object({
  mode: z.literal("balance"),
  targetBalance: z.coerce.number(),
  countAsCash: z.boolean().default(true),
});

const investmentBalanceCorrectionSchema = z.object({
  mode: z.literal("investment"),
  unit: z.coerce.number().min(0, "Unit tidak boleh negatif"),
  pricePerUnit: z.coerce.number(),
});

export function accountBalanceCorrectionSchema(accountType: AccountType) {
  if (accountType === "investment") return investmentBalanceCorrectionSchema;
  return cashBalanceCorrectionSchema;
}

export type AccountBalanceCorrectionFormValues = z.input<
  typeof cashBalanceCorrectionSchema | typeof investmentBalanceCorrectionSchema
>;
export type AccountBalanceCorrectionFormOutput = z.output<
  typeof cashBalanceCorrectionSchema | typeof investmentBalanceCorrectionSchema
>;
