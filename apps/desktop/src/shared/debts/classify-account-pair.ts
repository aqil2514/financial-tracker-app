import type { AccountType } from "@/lib/account-types";

/**
 * Klasifikasi EKSPLISIT pasangan (sumber, tujuan) transfer berdasar
 * account_type — sengaja TIDAK memakai pola "bukan debt berarti cash"
 * (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
 * #4). Begitu tipe akun ketiga (investment/dst) ditambahkan, kombinasi
 * apa pun yang melibatkannya WAJIB ditambah variant baru di sini + di
 * setiap konsumen (apply-debt-transaction.ts, use-transaction-debt-fields.ts,
 * Worker apps/worker/src/modules/debts/service.ts) — classifyAccountPair
 * throw UnsupportedAccountPairError utk kombinasi yang belum dikenal
 * daripada diam-diam disamakan dgn cash atau di-no-op-kan.
 *
 * `cash-investment` ditambahkan lebih dulu (bukan sekaligus dgn
 * `investment-cash`) karena HANYA pembelian (kas -> investment) yang
 * SAAT ITU punya model data final (lihat docs/concept/konsep-investasi.md,
 * "Unit dan harga per unit"). Penarikan/penjualan sebagian (investment ->
 * cash) sempat sengaja BELUM didukung — pertanyaan terbuka FIFO/average
 * cost + realized gain/loss belum terjawab.
 *
 * **Revisi 2026-10-07**: model penjualan (average cost, realized P/L,
 * validasi oversell) sudah disepakati + diimplementasikan (lihat bagian
 * "Penjualan/penarikan sebagian" di dokumen yang sama) — `investment-cash`
 * SEKARANG didukung, lihat apply-sell-investment-transaction.ts. Kombinasi
 * investment lain (investment-debt, investment-investment, dll) TETAP
 * throw UnsupportedAccountPairError — belum ada model datanya sama sekali.
 */
export type AccountPairKind =
  | "cash-cash"
  | "cash-debt"
  | "debt-cash"
  | "debt-debt"
  | "cash-investment"
  | "investment-cash";

export class UnsupportedAccountPairError extends Error {
  constructor(sourceType: string, destinationType: string) {
    super(
      `Kombinasi transfer akun bertipe '${sourceType}' -> '${destinationType}' belum didukung. ` +
        `Setiap tipe akun baru butuh logic eksplisit sebelum bisa dipakai di transfer.`
    );
    this.name = "UnsupportedAccountPairError";
  }
}

export function classifyAccountPair(
  sourceType: AccountType,
  destinationType: AccountType
): AccountPairKind {
  if (sourceType === "cash" && destinationType === "cash") return "cash-cash";
  if (sourceType === "cash" && destinationType === "debt") return "cash-debt";
  if (sourceType === "debt" && destinationType === "cash") return "debt-cash";
  if (sourceType === "debt" && destinationType === "debt") return "debt-debt";
  if (sourceType === "cash" && destinationType === "investment") return "cash-investment";
  if (sourceType === "investment" && destinationType === "cash") return "investment-cash";
  throw new UnsupportedAccountPairError(sourceType, destinationType);
}
