import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "../call-tool-as-json";
import type { CashflowDateRangeArgs } from "./shared";

export type RetailkuCashflowDetailRow = {
  date: string;
  description: string | null;
  sourceType: string | null;
  sourceNumber: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  /** `true` kalau akun ini akun deposit provider PPOB (mis. Seabank),
   * BUKAN akun tempat pendapatan diterima. Satu transaksi `sourceType:
   * "SALE"` yang mengandung item PPOB bisa menghasilkan 2 baris cashflow
   * di 2 akun berbeda dengan `sourceType` yang SAMA — baris ini
   * (`true`) secara ekonomi adalah PENGELUARAN (bayar ke provider),
   * bukan pendapatan, meski `sourceType`-nya SALE. Lihat
   * docs/todos/plan/retailku-sale-category-mapping.md. */
  isProviderPayoutAccount: boolean;
  /** Semua tipe produk (`"MERCHANDISE"`, `"PPOB"`, `"CONSIGNMENT"`, dst
   * — daftar penuh: enum `ProductType` di skema Retailku) yang terlibat
   * di transaksi penjualan SUMBER baris ini, di-dedupe. `null` kalau
   * `sourceType` bukan `"SALE"` (transaksi tidak punya `saleTransaction`).
   * GENERIK untuk semua tipe produk yang terjual, BUKAN cuma penanda
   * PPOB/CONSIGNMENT — konsumen yang memfilter tipe mana yang relevan.
   * Berguna terutama untuk deteksi CONSIGNMENT (baris "Hutang ke
   * Penitip" tidak pernah muncul di sini karena bukan akun kas/bank —
   * lihat docs/todos/plan/retailku-sale-category-mapping.md). */
  productTypes: string[] | null;
  /** Jumlah Rupiah dari nilai transaksi SALE ini yang BUKAN pendapatan
   * murni toko — gabungan payout ke provider PPOB + hutang ke penitip
   * consignment. Direkonstruksi akurat dari `totalCost` item
   * PPOB/CONSIGNMENT (SUDAH tersimpan permanen di sisi Retailku, BUKAN
   * estimasi) — verifikasi nyata (2026-09-23): `totalCost` item
   * CONSIGNMENT persis sama dengan nilai baris jurnal "Hutang ke
   * Penitip". `null` kalau `sourceType` bukan `"SALE"` ATAU transaksi
   * tidak mengandung item PPOB/CONSIGNMENT sama sekali; `0` kalau ada
   * item itu tapi porsinya nihil. Kurangi nilai `debit`/`credit` baris
   * ini dengan `nonRevenuePortion` untuk dapat pendapatan bersih toko.
   * Lihat docs/todos/plan/retailku-sale-category-mapping.md. */
  nonRevenuePortion: number | null;
  debit: number;
  credit: number;
};

export type RetailkuCashflowDetail = {
  data: RetailkuCashflowDetailRow[];
  meta: { pagination: { page: number; limit: number; total: number; totalPages: number } };
};

/** Panggil tool `get_cashflow_detail` (baru dibangun & didaftarkan di
 * sisi Retailku, lihat retailku-cashflow-sync.md) — detail pergerakan
 * kas per transaksi individual, dengan pagination. */
export async function getCashflowDetail(
  client: Client,
  args: CashflowDateRangeArgs & { page?: number; limit?: number }
): Promise<RetailkuCashflowDetail> {
  return callToolAsJson<RetailkuCashflowDetail>(client, "get_cashflow_detail", args);
}
