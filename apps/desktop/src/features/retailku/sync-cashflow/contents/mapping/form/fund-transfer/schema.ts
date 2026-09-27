import { z } from "zod";

/** Schema Zod utk 1 baris mapping FUND_TRANSFER (2 akun) — lihat
 * docs/todos/plan/retailku-dynamic-sourcetype-mapping.md. SEBELUMNYA
 * dibungkus `z.discriminatedUnion("sourceType", [...])` (keputusan
 * 2026-09-26, dirancang utk 1 schema gabungan lintas `sourceType`) —
 * DISEDERHANAKAN 2026-09-28 setelah keputusan `FlexRenderForm`
 * (`form/index.tsx`) jadi titik SWITCH varian (React, bukan Zod) —
 * tiap varian sekarang punya `schema.ts` SENDIRI-SENDIRI, sejajar,
 * SAMA pola dgn `form/generic/schema.ts`, tidak perlu digabung satu
 * discriminatedUnion lagi. */
export const fundTransferMappingSchema = z
  .object({
    key: z.string().min(1, "Key mapping wajib ada"),
    fromAccountId: z.string().min(1, "Akun asal (Dari) wajib dipilih"),
    toAccountId: z.string().min(1, "Akun tujuan (Ke) wajib dipilih"),
    // `note` WAJIB sama seperti `transactions/form/add-edit/schema.ts`
    // (berlaku SEMUA tipe transaksi termasuk transfer, BUKAN cuma
    // generic — klaim awal PoC "transfer tidak butuh field ini" KELIRU,
    // dikoreksi user 2026-09-28).
    note: z.string(),
    categoryId: z.string().nullable(),
    description: z.any().nullable(),
    // "Mengikuti Retailku" (migrasi 0024, `extra_fields`) — saat `true`,
    // `note`/`description` di ATAS jadi FALLBACK saja (dinonaktifkan di
    // UI), nilai aktual diambil dari `description` transaksi ASLI
    // Retailku per transaksi saat insert nanti (jalur itu belum ada).
    noteFollowSource: z.boolean(),
    descriptionFollowSource: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.fromAccountId && values.toAccountId && values.fromAccountId === values.toAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "Akun tujuan harus berbeda dari akun asal",
      });
    }
  });

export type FundTransferMappingFormValues = z.input<typeof fundTransferMappingSchema>;
export type FundTransferMappingFormOutput = z.output<typeof fundTransferMappingSchema>;
