import { z } from "zod";

/** Schema Zod utk 1 baris mapping AR_AP (piutang/utang per AKUN JURNAL
 * Retailku) — lihat JSDoc `ArApMappingRowDraft`. BEDA dari
 * `fundTransferMappingSchema`: HANYA 1 akun (`localAccountId`, akun
 * DEBT — bukan akun kas). `contactId` OPSIONAL di schema (validasi
 * "wajib kalau toggle OFF" dilakukan di `superRefine`, BUKAN
 * `.min(1)` polos) — kalau `contactFollowSource` ON, kontak diambil
 * OTOMATIS dari nama pihak Retailku per transaksi, `contactId` statis
 * jadi tidak relevan. TIDAK ADA field akun kas di sini — itu di luar
 * scope mapping (jalur sync AR/AP belum menanganinya). TIDAK ADA
 * `categoryId` (BEDA dari `genericMappingSchema`/`fundTransferMappingSchema`)
 * — kategori cuma berlaku utk transaksi income/expense, AR/AP SELALU
 * transfer, lihat JSDoc `ArApMappingRowDraft`. */
export const arApMappingSchema = z
  .object({
    key: z.string().min(1),
    localAccountId: z.string().min(1, "Akun utang-piutang wajib dipilih"),
    contactId: z.string().nullable(),
    contactFollowSource: z.boolean(),
    note: z.string(),
    description: z.any().nullable(),
  })
  .superRefine((values, ctx) => {
    if (!values.contactFollowSource && !values.contactId) {
      ctx.addIssue({
        code: "custom",
        path: ["contactId"],
        message: "Kontak wajib dipilih kalau tidak mengikuti Retailku",
      });
    }
  });

export type ArApMappingFormValues = z.input<typeof arApMappingSchema>;
export type ArApMappingFormOutput = z.output<typeof arApMappingSchema>;
