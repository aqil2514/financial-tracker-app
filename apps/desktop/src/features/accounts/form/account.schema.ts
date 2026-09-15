import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi"),
  initial_balance: z.coerce.number(),
});

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountFormOutput = z.output<typeof accountSchema>;
