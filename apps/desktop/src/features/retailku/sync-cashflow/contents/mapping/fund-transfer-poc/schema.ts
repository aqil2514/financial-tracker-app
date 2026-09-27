import { z } from "zod";

/** PoC skema mapping utk `sourceType` SPESIAL pertama (FUND_TRANSFER) —
 * lihat docs/todos/plan/retailku-dynamic-sourcetype-mapping.md.
 * `z.discriminatedUnion` per `sourceType` (keputusan sadar 2026-09-26,
 * menyalahi preseden `transactions/form/add-edit` yg pakai flat+
 * superRefine, demi type-safety compile-time antar `sourceType` yg
 * field wajibnya beda-beda). Baru 1 varian sekarang — varian
 * `sourceType` spesial lain (CONSIGNMENT_SETTLEMENT, SALE_PAYMENT, dst)
 * menyusul satu per satu, BUKAN sekaligus. */
const fundTransferMappingSchema = z
  .object({
    sourceType: z.literal("FUND_TRANSFER"),
    key: z.string().min(1, "Key mapping wajib ada"),
    fromAccountId: z.string().min(1, "Akun asal (Dari) wajib dipilih"),
    toAccountId: z.string().min(1, "Akun tujuan (Ke) wajib dipilih"),
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

export const sourceTypeMappingSchema = z.discriminatedUnion("sourceType", [fundTransferMappingSchema]);

export type SourceTypeMappingFormValues = z.input<typeof sourceTypeMappingSchema>;
export type SourceTypeMappingFormOutput = z.output<typeof sourceTypeMappingSchema>;
export type FundTransferMappingFormValues = z.input<typeof fundTransferMappingSchema>;
