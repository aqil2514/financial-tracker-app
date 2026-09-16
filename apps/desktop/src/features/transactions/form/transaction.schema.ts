import { z } from "zod";

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    account_id: z.string().min(1, "Akun wajib dipilih"),
    category_id: z.string().nullable(),
    transfer_account_id: z.string().nullable(),
    note: z.string().nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
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
