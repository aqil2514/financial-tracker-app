// Klasifikasi eksplisit pasangan (sumber, tujuan) transfer berdasar
// account_type — sengaja tidak memakai pola "bukan debt berarti cash"
// (pola sama seperti apps/desktop/src/shared/debts/classify-account-pair.ts).
// third_party hanya valid untuk third_party-third_party (pindah tempat
// dan/atau kepemilikan); cash<->third_party SENGAJA tidak diklasifikasi
// (titip/ambil adalah income/expense satu sisi, bukan transfer dengan kas).
export type AccountPairKind =
  | "cash-cash"
  | "cash-debt"
  | "debt-cash"
  | "debt-debt"
  | "cash-investment"
  | "investment-cash"
  | "cash-forex"
  | "forex-cash"
  | "third_party-third_party";

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
  if (sourceType === "cash" && destinationType === "investment") return "cash-investment";
  if (sourceType === "investment" && destinationType === "cash") return "investment-cash";
  if (sourceType === "cash" && destinationType === "forex") return "cash-forex";
  if (sourceType === "forex" && destinationType === "cash") return "forex-cash";
  if (sourceType === "third_party" && destinationType === "third_party") return "third_party-third_party";
  throw new UnsupportedAccountPairError(sourceType, destinationType);
}
