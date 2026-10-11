import { z } from "zod";

import { dateRangeSchema } from "@/components/forms/form-fields/form-field-date-range";

export const categoryPeriodSchema = z.object({
  category_id: z.string().min(1, "Kategori wajib dipilih"),
  name: z.string().min(1, "Nama periode wajib diisi"),
  date_range: dateRangeSchema,
});

export type CategoryPeriodFormValues = z.input<typeof categoryPeriodSchema>;
export type CategoryPeriodFormOutput = z.output<typeof categoryPeriodSchema>;
