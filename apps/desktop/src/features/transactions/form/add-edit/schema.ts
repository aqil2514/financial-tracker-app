import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    account_id: z.string().min(1, "Akun wajib dipilih"),
    category_id: z.string().nullable(),
    transfer_account_id: z.string().nullable(),
    note: z.string().min(1, "Catatan wajib diisi"),
    description: z.custom<JSONContent>().nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
    contact_name: z.string().nullable(),
    /** Cuma relevan saat transfer dari akun `debt` ke akun `cash` —
     * arah transfer semata ambigu (bisa pelunasan piutang ATAU utang
     * baru), jadi user pilih eksplisit. Null di luar kasus itu. */
    debt_action: z.enum(["settlement", "payable"]).nullable(),
    /** Piutang (debts.id, sebagai string) yang dipilih untuk dilunasi —
     * cuma relevan saat debt_action === 'settlement'. */
    settle_debt_ids: z.array(z.string()),
    /** Jumlah unit & harga per unit saat pembelian — relevan hanya saat
     * transfer tujuannya akun `investment` (lihat
     * use-transaction-investment-fields.ts), null di luar kasus itu.
     * SENGAJA tidak divalidasi terhadap `amount` (lihat
     * docs/concept/konsep-investasi.md bagian "Unit dan harga per unit").
     * OPSIONAL kalau `investment_status` 'pending', WAJIB kalau 'settled'
     * — divalidasi di useTransactionInvestmentFields (butuh tahu account
     * type tujuan, tidak bisa murni di sini). */
    unit: z.coerce.number().nullable(),
    price_per_unit: z.coerce.number().nullable(),
    /** Status baris `investment_purchases` yang akan dibuat/diupdate —
     * cuma relevan saat transfer tujuannya akun `investment`, null di
     * luar kasus itu. Lihat docs/concept/konsep-investasi.md bagian
     * "Settlement tertunda". */
    investment_status: z.enum(["pending", "settled"]).nullable(),
    /** Nama label (scope 'transaction_category', BUKAN id) yang dipilih
     * dari combobox multi-select -- resolusi ke id (termasuk create label
     * baru) terjadi di mutationFn lewat resolveLabelIds. Boleh lebih dari
     * satu label sekaligus (keputusan 2026-10-09), lihat label-field.tsx. */
    label_names: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.type === "transfer") {
      if (!values.transfer_account_id) {
        ctx.addIssue({
          code: "custom",
          path: ["transfer_account_id"],
          message: "Akun tujuan wajib dipilih",
        });
      }
      if (values.transfer_account_id === values.account_id) {
        ctx.addIssue({
          code: "custom",
          path: ["transfer_account_id"],
          message: "Akun tujuan harus berbeda dari akun sumber",
        });
      }
    }
  });

export type TransactionFormValues = z.input<typeof transactionSchema>;
export type TransactionFormOutput = z.output<typeof transactionSchema>;
