import { z } from "zod";

export const payDebtSchema = z
  .object({
    /** 'cash' = jalur lama, uang riil berpindah lewat akun kas (transfer
     * kalau debt.account_id ada, income/expense biasa kalau tidak).
     * 'non_cash' = piutang/utang selesai TANPA uang berpindah sama
     * sekali (barter, pemutihan, saling-offset — disimplifikasi jadi 1
     * jalur, lihat docs/todos/plan/debts-sync-and-non-transfer-debts.md) —
     * tidak ada transaksi/akun kas yang terlibat. */
    settlement_mode: z.enum(["cash", "non_cash"]),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    cash_account_id: z.string().nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
  })
  .refine((values) => values.settlement_mode !== "cash" || values.cash_account_id, {
    message: "Akun kas wajib dipilih",
    path: ["cash_account_id"],
  });

export type PayDebtFormValues = z.input<typeof payDebtSchema>;
export type PayDebtFormOutput = z.output<typeof payDebtSchema>;
