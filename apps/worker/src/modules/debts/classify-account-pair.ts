// Port PERSIS dari apps/desktop/src/shared/debts/classify-account-pair.ts
// -- klasifikasi EKSPLISIT pasangan (sumber, tujuan) transfer berdasar
// account_type, sengaja TIDAK memakai pola "bukan debt berarti cash"
// (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
// #4). Begitu tipe akun ketiga ditambahkan, kombinasi apa pun yang
// melibatkannya WAJIB ditambah variant baru di sini + di desktop +
// setiap konsumen (debts/service.ts, transactions/service.ts).
export type AccountPairKind = "cash-cash" | "cash-debt" | "debt-cash" | "debt-debt";

// sourceType/destinationType tetap `string` (bukan AccountType) -- datang
// mentah dari query SQL (getAccountType, debts/service.ts), DB tidak
// menjamin tipe TS statis, cuma CHECK constraint di level runtime.
// classifyAccountPair throw utk nilai apa pun di luar cash/debt, jadi
// tetap aman meski parameternya belum di-narrow ke AccountType di sini.

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
  throw new UnsupportedAccountPairError(sourceType, destinationType);
}
