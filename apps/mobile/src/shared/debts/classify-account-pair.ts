// Klasifikasi eksplisit pasangan (sumber, tujuan) transfer berdasar
// account_type — sengaja tidak memakai pola "bukan debt berarti cash"
// (pola sama seperti apps/desktop/src/shared/debts/classify-account-pair.ts).
// Mobile baru punya tipe cash/debt (investment/third_party belum
// di-porting), jadi kombinasi yang didukung di sini masih subset dari
// desktop — tambah variant baru begitu tipe akun lain menyusul.
export type AccountPairKind = "cash-cash" | "cash-debt" | "debt-cash" | "debt-debt";

export class UnsupportedAccountPairError extends Error {
  constructor(sourceType: string, destinationType: string) {
    super(
      `Kombinasi transfer akun bertipe '${sourceType}' -> '${destinationType}' belum didukung.`
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
