import { z } from "zod";

// Subset kolom tabel `contacts` (lihat lib/database/migrations/
// 0008_debts.ts) yang relevan untuk form create/edit. `note` di sini
// plain text biasa — BEDA dari desktop yang menyimpan rich text TipTap,
// lihat docs/todos/plan/porting-account-debt.md bagian CRUD Kontak.
export const contactSchema = z.object({
  name: z.string().min(1, "Nama kontak wajib diisi"),
  note: z.string().nullable(),
});

export type ContactFormValues = z.input<typeof contactSchema>;
export type ContactFormOutput = z.output<typeof contactSchema>;
