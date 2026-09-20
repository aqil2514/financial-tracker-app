import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi"),
  initial_balance: z.coerce.number(),
  group_id: z.string().nullable(),
  description: z.string().nullable(),
  is_active: z.enum(["1", "0"]),
  account_type: z.enum(["cash", "debt"]),
  icon: z.string().nullable(),
  color: z.string().nullable(),
});

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountFormOutput = z.output<typeof accountSchema>;
