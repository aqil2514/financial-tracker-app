/**
 * Satu-satunya tempat union type `AccountType` didefinisikan di app ini
 * (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
 * #6) — begitu tipe akun ketiga ditambahkan, cukup edit file ini +
 * ACCOUNT_TYPE_OPTIONS, bukan grep 8+ lokasi tersebar. SQL CHECK
 * constraint (migrations/0013_account_type.sql) tetap butuh migrasi
 * baru sendiri — tidak bisa di-reuse dari sini.
 */
export type AccountType = "cash" | "debt" | "investment" | "third_party";

export const ACCOUNT_TYPES = [
  "cash",
  "debt",
  "investment",
  "third_party",
] as const satisfies readonly AccountType[];

export const ACCOUNT_TYPE_OPTIONS: Array<{
  value: AccountType;
  label: string;
  description: string;
  badgeClassName: string;
}> = [
  {
    value: "cash",
    label: "Kas/Bank",
    description:
      "Akun uang sungguhan, seperti dompet, rekening bank, atau kartu kredit.",
    badgeClassName: "bg-green-600/10 text-green-600",
  },
  {
    value: "debt",
    label: "Utang Piutang",
    description:
      "Akun virtual untuk melacak pinjaman ke/dari orang lain — bukan uang sungguhan.",
    badgeClassName: "bg-red-600/10 text-red-600",
  },
  {
    value: "investment",
    label: "Investasi",
    description:
      "Satu instrumen investasi tunggal (reksadana, saham, dst) — melacak unit dan harga per unit",
    badgeClassName: "bg-blue-600/10 text-blue-600",
  },
  {
    value: "third_party",
    label: "Dana Pihak Ketiga",
    description:
      "Akun virtual untuk titipan dana milik orang lain — bukan uang Anda, dibedakan per kontak.",
    badgeClassName: "bg-amber-600/10 text-amber-600",
  },
];

// `third_party` ditambahkan 2026-10-21 (lihat docs/todos/plan/account-type-third-party.md
// poin 9) -- third_party_funds adalah tabel data turunan independen dari
// accounts.balance, sama persis pola debts/investment_purchases. Koreksi
// Saldo generik (satu field nominal, ditembak ke AKUN) tidak tahu kontak
// mana yang nominalnya salah -- satu akun third_party bisa menampung
// riwayat BANYAK kontak independen sekaligus (persis debt). Guard
// tolak-total ini SEMENTARA, pola sama persis "debt" sebelum jalur
// granularnya ada -- lihat docs/todos/done/balance-correction-derived-data-consistency.md.
const ACCOUNT_TYPES_RESTRICTED_FROM_BALANCE_CORRECTION: readonly AccountType[] =
  ["debt", "third_party"];

export function isAccountTypeRestrictedFromBalanceCorrection(
  accountType: AccountType,
): boolean {
  return ACCOUNT_TYPES_RESTRICTED_FROM_BALANCE_CORRECTION.includes(accountType);
}
