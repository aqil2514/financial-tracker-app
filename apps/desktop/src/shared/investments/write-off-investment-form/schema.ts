import { z } from "zod";

/**
 * Pola PERSIS `sell-investment-form/schema.ts`, lebih sederhana — TIDAK
 * ada `cash_account_id`/`status` sama sekali (write-off TIDAK PERNAH
 * punya akun kas tujuan maupun konsep pending, lihat
 * apply-write-off-investment-transaction.ts). `unit` WAJIB, sama alasan
 * jual (harus tahu persis berapa unit yang dilepas untuk validasi
 * oversell) — TIDAK ada field harga/nominal sama sekali, nominal
 * transaksi dihitung OTOMATIS dari `averageCost × unit` di
 * use-write-off-investment.ts (keputusan 2026-10-08, lihat
 * docs/concept/konsep-investasi.md).
 */
export const writeOffInvestmentSchema = z.object({
  investment_account_id: z.string().min(1, "Akun investasi wajib dipilih"),
  unit: z.coerce.number().positive("Jumlah unit harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().min(1, "Catatan wajib diisi"),
});

export type WriteOffInvestmentFormValues = z.input<typeof writeOffInvestmentSchema>;
export type WriteOffInvestmentFormOutput = z.output<typeof writeOffInvestmentSchema>;
