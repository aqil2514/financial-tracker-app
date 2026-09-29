import { z } from "zod";

export const newDebtSchema = z
  .object({
    /** 'receivable' = saya meminjamkan (kas keluar ke akun debt),
     * 'payable' = saya berutang (kas masuk dari akun debt). Menentukan
     * arah transfer yang dibuat di baliknya — lihat use-create-debt.ts. */
    debt_type: z.enum(["receivable", "payable"]),
    contact_name: z.string().min(1, "Nama kontak wajib diisi").nullable(),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    cash_account_id: z.string().min(1, "Akun kas wajib dipilih"),
    debt_account_id: z.string().min(1, "Akun utang piutang wajib dipilih"),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
  })
  .refine((values) => values.cash_account_id !== values.debt_account_id, {
    message: "Akun kas dan akun utang piutang harus berbeda",
    path: ["debt_account_id"],
  });

export type NewDebtFormValues = z.input<typeof newDebtSchema>;
export type NewDebtFormOutput = z.output<typeof newDebtSchema>;
