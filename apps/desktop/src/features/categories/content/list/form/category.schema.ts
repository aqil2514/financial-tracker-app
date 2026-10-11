import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  type: z.enum(["income", "expense"]),
  parent_id: z.string().nullable(),
  is_active: z.enum(["1", "0"]),
  /** Nama label (scope 'transaction_category', BUKAN id) -- sama prinsip
   * dgn transaction.schema.ts, lihat shared/labels/label-field.tsx. */
  label_names: z.array(z.string()),
});

export type CategoryFormValues = z.input<typeof categorySchema>;
export type CategoryFormOutput = z.output<typeof categorySchema>;
