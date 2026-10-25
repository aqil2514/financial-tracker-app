import { z } from "zod";

// Subset dari schema desktop (apps/desktop/.../form/add-edit/schema/schema.ts)
// — hanya field yang sesuai skema tabel `transactions` mobile saat ini
// (lihat lib/database/migrations/0001_initial.ts). Belum ada contact_name/
// settle_debt_ids/unit/price_per_unit/investment_status/label_names/
// source_ref — semua itu butuh tabel pendukung (debts, investment_*,
// labels) yang belum dibuat di mobile. transfer_account_id disiapkan di
// schema karena sudah ada kolomnya di tabel, tapi field UI-nya menyusul.
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
