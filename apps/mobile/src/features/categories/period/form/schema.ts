import { z } from "zod";

export const categoryPeriodSchema = z
  .object({
    name: z.string().min(1, "Nama periode wajib diisi"),
    category_ids: z.array(z.string()).min(1, "Pilih minimal satu kategori"),
    start_date: z.string().min(1, "Tanggal mulai wajib diisi"),
    end_date: z.string().min(1, "Tanggal selesai wajib diisi"),
  })
  .superRefine((values, ctx) => {
    if (values.end_date < values.start_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
      });
    }
  });

export type CategoryPeriodFormValues = z.input<typeof categoryPeriodSchema>;
export type CategoryPeriodFormOutput = z.output<typeof categoryPeriodSchema>;
