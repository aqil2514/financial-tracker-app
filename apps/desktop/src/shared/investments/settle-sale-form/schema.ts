import { z } from "zod";

/** Dialog "Settle Penjualan" cuma butuh akun kas tujuan -- unit/harga
 * jual sudah terkunci dari baris `investment_sales` pending yang sedang
 * disettle (lihat settle-sale-dialog.tsx), TIDAK bisa diubah di sini
 * (beda dari edit pembelian yang boleh koreksi unit/harga). */
export const settleSaleSchema = z.object({
  cash_account_id: z.string().min(1, "Akun kas wajib dipilih"),
});

export type SettleSaleFormValues = z.input<typeof settleSaleSchema>;
export type SettleSaleFormOutput = z.output<typeof settleSaleSchema>;
