import { z } from "zod";

export const accountGroupSchema = z.object({
  name: z.string().min(1, "Nama group wajib diisi"),
});

export type AccountGroupFormValues = z.input<typeof accountGroupSchema>;
export type AccountGroupFormOutput = z.output<typeof accountGroupSchema>;
