import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.coerce.number().nonnegative("Nominal tidak boleh negatif"),
    account_id: z.string().min(1, "Akun wajib dipilih"),
    category_id: z.string().nullable(),
    transfer_account_id: z.string().nullable(),
    note: z.string().min(1, "Catatan wajib diisi"),
    description: z.custom<JSONContent>().nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
    contact_name: z.string().nullable(),
    settle_debt_ids: z.array(z.string()),
    unit: z.coerce.number().nullable(),
    price_per_unit: z.coerce.number().nullable(),
    investment_status: z.enum(["pending", "settled"]).nullable(),
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
