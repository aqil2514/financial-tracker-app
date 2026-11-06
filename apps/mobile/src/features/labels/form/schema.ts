import { z } from "zod";

export const labelSchema = z.object({
  name: z.string().trim().min(1, "Nama label wajib diisi"),
  scope: z.enum(["transaction_category", "account"]),
});

export type LabelFormValues = z.input<typeof labelSchema>;
export type LabelFormOutput = z.output<typeof labelSchema>;
