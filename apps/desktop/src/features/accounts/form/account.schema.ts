import { z } from "zod";
import { ACCOUNT_TYPES } from "@/lib/account-types";

export const accountSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi"),
  initial_balance: z.coerce.number(),
  group_id: z.string().nullable(),
  description: z.string().nullable(),
  is_active: z.enum(["1", "0"]),
  account_type: z.enum(ACCOUNT_TYPES),
  icon: z.string().nullable(),
  color: z.string().nullable(),
});

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountFormOutput = z.output<typeof accountSchema>;
