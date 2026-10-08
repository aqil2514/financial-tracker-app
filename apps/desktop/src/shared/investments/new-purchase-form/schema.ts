import { z } from "zod";

export const newInvestmentPurchaseSchema = z
  .object({
    /** 'transfer' = jalur lama, unit lahir dari transaksi transfer kas ->
     * investment (saldo akun kas ikut berkurang). 'direct' = unit
     * bertambah TANPA transfer kas (hibah, bonus saham, right issue/
     * warrant tanpa modal tambahan, atau saldo & unit awal sebelum pakai
     * app) -- tidak menyentuh akun kas manapun, tapi TETAP wajib transaksi
     * `income` pada akun investment itu sendiri (lihat
     * use-create-investment-purchase.ts + docs/concept/konsep-investasi.md
     * bagian "Unit yang berubah TANPA transfer kas"), pola persis
     * `record_mode` di shared/debts/new-debt-form/schema.ts. */
    record_mode: z.enum(["transfer", "direct"]),
    cash_account_id: z.string().nullable(),
    investment_account_id: z.string().min(1, "Akun investasi wajib dipilih"),
    amount: z.coerce.number().nonnegative("Nominal tidak boleh negatif"),
    // OPSIONAL kalau status 'pending' (order beli yang masih diproses,
    // mis. reksadana, belum tahu unit pastinya sampai settlement
    // dikonfirmasi) -- tapi WAJIB kalau user langsung pilih 'settled' saat
    // mencatat (nilainya sudah pasti saat itu juga, tidak ada alasan
    // dikosongkan), dan WAJIB untuk record_mode 'direct' (tidak ada konsep
    // pending untuk hibah/bonus yang sudah diterima). Lihat superRefine
    // di bawah + apply-investment-transaction.ts.
    unit: z.coerce.number().positive("Jumlah unit harus lebih dari 0").nullable(),
    price_per_unit: z.coerce.number().positive("Harga per unit harus lebih dari 0").nullable(),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
    status: z.enum(["pending", "settled"]),
  })
  .superRefine((values, ctx) => {
    if (values.record_mode === "transfer" && !values.cash_account_id) {
      ctx.addIssue({ code: "custom", path: ["cash_account_id"], message: "Akun kas wajib dipilih" });
    }
    if (values.record_mode === "transfer" && values.amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Nominal harus lebih dari 0" });
    }
    // record_mode 'direct' selalu dianggap settled (nilainya sudah pasti
    // saat diterima) -- wajib unit & harga per unit, sama seperti status
    // 'settled' di jalur transfer, TAPI harga per unit WAJIB walau unit
    // mungkin diisi (beda dari transfer yang cuma wajib saat status
    // 'settled') supaya cost basis lot ini TIDAK PERNAH 0 -- average cost
    // gabungan (getAverageCostPerUnit, investment-holding-math.ts) kalau
    // ikut men-SUM baris berharga 0 akan "mengencerkan" cost basis unit
    // yang dibeli riil, merusak akurasi Realized P/L saat dijual nanti.
    const needsUnitPrice = values.status === "settled" || values.record_mode === "direct";
    if (needsUnitPrice) {
      if (values.unit == null) {
        ctx.addIssue({
          code: "custom",
          path: ["unit"],
          message: "Jumlah unit wajib diisi",
        });
      }
      if (values.price_per_unit == null) {
        ctx.addIssue({
          code: "custom",
          path: ["price_per_unit"],
          message: "Harga per unit wajib diisi",
        });
      }
    }
  });

export type NewInvestmentPurchaseFormValues = z.input<typeof newInvestmentPurchaseSchema>;
export type NewInvestmentPurchaseFormOutput = z.output<typeof newInvestmentPurchaseSchema>;
