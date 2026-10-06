import { z } from "zod";

/**
 * Pola PERSIS `new-purchase-form/schema.ts`, arah sebaliknya (investment
 * -> cash). Beda utama dari form beli:
 * - `unit`/`price_per_unit` WAJIB (bukan opsional) — lihat
 *   docs/concept/konsep-investasi.md bagian "Input jual": beda dari beli
 *   yang boleh belum tahu nilai pasti (order masih pending), jual harus
 *   tahu persis berapa unit yang dilepas untuk divalidasi terhadap sisa
 *   unit (oversell) — TIDAK ada mekanisme "isi belakangan" untuk jual.
 * - TIDAK ada field `amount` manual — nominal transfer dihitung OTOMATIS
 *   dari `unit * price_per_unit` di use-create-investment-sale.ts (lihat
 *   komentar di sana soal kenapa read-only, bukan field terpisah di
 *   schema ini sama sekali).
 */
export const sellInvestmentSchema = z.object({
  cash_account_id: z.string().min(1, "Akun kas wajib dipilih"),
  investment_account_id: z.string().min(1, "Akun investasi wajib dipilih"),
  unit: z.coerce.number().positive("Jumlah unit harus lebih dari 0"),
  price_per_unit: z.coerce.number().positive("Harga per unit harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().min(1, "Catatan wajib diisi"),
  status: z.enum(["pending", "settled"]),
});

export type SellInvestmentFormValues = z.input<typeof sellInvestmentSchema>;
export type SellInvestmentFormOutput = z.output<typeof sellInvestmentSchema>;
