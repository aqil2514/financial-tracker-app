// Port PERSIS dari apps/desktop/src/shared/debts/classify-account-pair.ts
// -- klasifikasi EKSPLISIT pasangan (sumber, tujuan) transfer berdasar
// account_type, sengaja TIDAK memakai pola "bukan debt berarti cash"
// (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
// #4). Begitu tipe akun ketiga ditambahkan, kombinasi apa pun yang
// melibatkannya WAJIB ditambah variant baru di sini + di desktop +
// setiap konsumen (debts/service.ts, transactions/service.ts).
//
// **Revisi 2026-10-07 (docs/todos/plan/investment-sync.md, Tahap 2)**:
// `cash-investment`/`investment-cash` ditambah, menyusul desktop yang
// sudah mendukung keduanya (pembelian DAN penjualan/penarikan sebagian
// investasi, lihat apps/desktop/src/shared/debts/classify-account-pair.ts).
// Kombinasi investment lain (investment-debt, investment-investment, dll)
// TETAP throw UnsupportedAccountPairError -- belum ada model datanya sama
// sekali di Worker maupun desktop.
export type AccountPairKind =
  | "cash-cash"
  | "cash-debt"
  | "debt-cash"
  | "debt-debt"
  | "cash-investment"
  | "investment-cash";

// sourceType/destinationType tetap `string` (bukan AccountType) -- datang
// mentah dari query SQL (getAccountType, debts/service.ts), DB tidak
// menjamin tipe TS statis, cuma CHECK constraint di level runtime.
// classifyAccountPair throw utk nilai apa pun di luar cash/debt/investment,
// jadi tetap aman meski parameternya belum di-narrow ke AccountType di sini.

export class UnsupportedAccountPairError extends Error {
  constructor(sourceType: string, destinationType: string) {
    super(
      `Kombinasi transfer akun bertipe '${sourceType}' -> '${destinationType}' belum didukung. ` +
        `Setiap tipe akun baru butuh logic eksplisit sebelum bisa dipakai di transfer.`
    );
    this.name = "UnsupportedAccountPairError";
  }
}

export function classifyAccountPair(sourceType: string, destinationType: string): AccountPairKind {
  if (sourceType === "cash" && destinationType === "cash") return "cash-cash";
  if (sourceType === "cash" && destinationType === "debt") return "cash-debt";
  if (sourceType === "debt" && destinationType === "cash") return "debt-cash";
  if (sourceType === "debt" && destinationType === "debt") return "debt-debt";
  if (sourceType === "cash" && destinationType === "investment") return "cash-investment";
  if (sourceType === "investment" && destinationType === "cash") return "investment-cash";
  throw new UnsupportedAccountPairError(sourceType, destinationType);
}
