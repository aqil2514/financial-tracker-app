import { z } from "zod";

export const newDebtSchema = z
  .object({
    /** 'receivable' = saya meminjamkan (kas keluar ke akun debt),
     * 'payable' = saya berutang (kas masuk dari akun debt). Menentukan
     * arah transfer yang dibuat di baliknya — lihat use-create-debt.ts. */
    debt_type: z.enum(["receivable", "payable"]),
    /** 'transfer' = jalur lama, piutang/utang lahir dari 1 transaksi
     * transfer kas<->debt (menyentuh saldo akun). 'direct' = piutang/utang
     * murni informasional (uang sudah berpindah DI LUAR app — pinjam
     * tunai, barter, piutang lama), tidak ada transaksi/saldo yang
     * tersentuh sama sekali. Lihat
     * docs/todos/plan/debts-sync-and-non-transfer-debts.md. */
    record_mode: z.enum(["transfer", "direct"]),
    contact_name: z.string().min(1, "Nama kontak wajib diisi").nullable(),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    cash_account_id: z.string().nullable(),
    debt_account_id: z.string().nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
  })
  .refine(
    (values) => values.record_mode !== "transfer" || values.cash_account_id,
    { message: "Akun kas wajib dipilih", path: ["cash_account_id"] }
  )
  .refine(
    (values) => values.record_mode !== "transfer" || values.debt_account_id,
    { message: "Akun utang piutang wajib dipilih", path: ["debt_account_id"] }
  )
  .refine(
    (values) =>
      values.record_mode !== "transfer" ||
      values.cash_account_id !== values.debt_account_id,
    { message: "Akun kas dan akun utang piutang harus berbeda", path: ["debt_account_id"] }
  );

export type NewDebtFormValues = z.input<typeof newDebtSchema>;
export type NewDebtFormOutput = z.output<typeof newDebtSchema>;
