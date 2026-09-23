import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "../call-tool-as-json";
import type { CashflowDateRangeArgs } from "./shared";

export type RetailkuCashflowDetailRow = {
  /** ID jurnal item INDIVIDUAL (unik selamanya di sisi Retailku,
   * SATU baris kas/bank/piutang/utang per entri jurnal) — dipakai
   * sebagai identitas idempotency baris piutang/utang (lihat
   * extract-ar-ap-rows.ts). Field ini SUDAH ADA di response server
   * sejak awal (`get-cfr-detail.helper.ts`: `id: item.id`), baru
   * dideklarasikan di sini saat kebutuhan AR/AP granular muncul —
   * TIDAK PERNAH relevan untuk cashflow biasa (agregasi per hari,
   * bukan per baris jurnal), makanya belum dipakai sebelumnya. */
  id: string;
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
  /** `true` kalau akun baris ini akun piutang/utang toko (kode
   * 1500/1700/1800/2100/2200/2300 di Retailku, ditandai via
   * `AccountMapping.role`), BUKAN akun kas/bank biasa — lihat
   * docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md. Baris ini
   * TIDAK boleh diagregasi sebagai net kas akun biasa (beda akun,
   * beda arti ekonomi) — konsumen HARUS proses lewat jalur AR/AP
   * terpisah (lihat extract-ar-ap-rows.ts). */
  isReceivablePayableAccount: boolean;
  /** `null` kalau `isReceivablePayableAccount` false. `"receivable"` =
   * akun piutang (debit menambah piutang/piutang baru, kredit
   * mengurangi/pelunasan) — `"payable"` = akun utang (kredit menambah
   * utang baru, debit mengurangi/pelunasan). */
  receivablePayableDirection: "receivable" | "payable" | null;
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
