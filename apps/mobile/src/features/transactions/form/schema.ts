import { z } from "zod";

// Subset dari schema desktop (apps/desktop/.../form/add-edit/schema/schema.ts)
// — hanya field yang sesuai skema tabel `transactions` mobile saat ini
// (lihat lib/database/migrations/0001_initial.ts). Belum ada unit/
// price_per_unit/investment_status/label_names/source_ref — semua itu
// butuh tabel pendukung (investment_*, labels) yang belum dibuat di
// mobile. account_id/transfer_account_id menyimpan accounts.id (lihat
// FormFieldAccount + AccountPickerSheet).
//
// contact_id/settle_debt_ids WAJIB diisi kalau transaksi melibatkan
// akun debt — tapi itu butuh tahu account_type/direction akun yang
// dipilih (data async dari DB), tidak bisa dihitung murni dari values
// di sini. Validasi itu dilakukan manual di transaction-form.tsx
// (pola sama seperti validateDebtFields desktop, dipanggil di luar
// zod schema) — di sini keduanya cukup opsional.
export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.coerce.number().nonnegative("Nominal tidak boleh negatif"),
    account_id: z.string().min(1, "Akun wajib diisi"),
    category_id: z.string().nullable(),
    transfer_account_id: z.string().nullable(),
    note: z.string().min(1, "Catatan wajib diisi"),
    description: z.string().nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
    contact_id: z.string().nullable(),
    settle_debt_ids: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.type === "transfer") {
      if (!values.transfer_account_id) {
        ctx.addIssue({
          code: "custom",
          path: ["transfer_account_id"],
          message: "Akun tujuan wajib diisi",
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
