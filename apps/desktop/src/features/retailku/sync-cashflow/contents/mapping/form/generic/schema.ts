import { z } from "zod";

/** Schema Zod utk 1 baris mapping generik (akun tunggal) — dipakai
 * `sourceType` yang TIDAK butuh skema spesial (SALE biasa, dst, lihat
 * docs/todos/plan/retailku-dynamic-sourcetype-mapping.md). Field
 * non-fakta (`note`/`categoryId`/`description`) semua OPSIONAL, kosong
 * = fallback default saat sync (lihat
 * docs/todos/plan/retailku-sync-field-mapping.md). Hanya `localAccountId`
 * yang wajib — tanpa itu key belum bisa dianggap "termapping". */
export const genericMappingSchema = z.object({
  key: z.string().min(1),
  localAccountId: z.string().min(1, "Akun tujuan wajib dipilih"),
  categoryId: z.string().nullable(),
  note: z.string(),
  description: z.any().nullable(),
  // "Mengikuti Retailku" (migrasi 0024, `extra_fields`) — baris generic
  // itu AGREGAT (gabungan banyak transaksi, mis. OPERATIONAL_EXPENSE
  // menggabungkan "Server Retailku" & "Amal" jadi 1 key, lihat JSDoc
  // `GenericMappingRowDraft`), toggle ini mengatasi hilangnya detail
  // "transaksi ini spesifiknya apa" kalau note/description dipaksa
  // statis 1 nilai utk semua transaksi yg tergabung.
  noteFollowSource: z.boolean(),
  descriptionFollowSource: z.boolean(),
});

export type GenericMappingFormValues = z.input<typeof genericMappingSchema>;
export type GenericMappingFormOutput = z.output<typeof genericMappingSchema>;
