import { z } from "zod";

// Subset dari kolom tabel `categories` (lihat lib/database/migrations/
// 0003_categories.ts) yang relevan untuk form create/edit. `icon` belum
// diaktifkan di UI (lihat docs/todos/plan/porting-category.md) dan
// `is_active` dikontrol lewat toggle di list, bukan field form.
export const categorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  type: z.enum(["income", "expense"]),
  parent_id: z.string().nullable(),
});

export type CategoryFormValues = z.input<typeof categorySchema>;
export type CategoryFormOutput = z.output<typeof categorySchema>;
