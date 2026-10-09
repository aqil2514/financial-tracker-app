/**
 * Satu-satunya tempat union type `AccountType` didefinisikan di app ini
 * (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
 * #6) — begitu tipe akun ketiga ditambahkan, cukup edit file ini +
 * ACCOUNT_TYPE_OPTIONS, bukan grep 8+ lokasi tersebar. SQL CHECK
 * constraint (migrations/0013_account_type.sql) tetap butuh migrasi
 * baru sendiri — tidak bisa di-reuse dari sini.
 */
export type AccountType = "cash" | "debt" | "investment";

export const ACCOUNT_TYPES = ["cash", "debt", "investment"] as const satisfies readonly AccountType[];

export const ACCOUNT_TYPE_OPTIONS: Array<{
  value: AccountType;
  label: string;
  description: string;
  badgeClassName: string;
}> = [
  {
    value: "cash",
    label: "Kas/Bank",
    description: "Akun uang sungguhan, seperti dompet, rekening bank, atau kartu kredit.",
    badgeClassName: "bg-green-600/10 text-green-600",
  },
  {
    value: "debt",
    label: "Utang Piutang",
    description: "Akun virtual untuk melacak pinjaman ke/dari orang lain — bukan uang sungguhan.",
    badgeClassName: "bg-red-600/10 text-red-600",
  },
  {
    value: "investment",
    label: "Investasi",
    description: "Satu instrumen investasi tunggal (reksadana, saham, dst) — melacak unit dan harga per unit",
    badgeClassName: "bg-blue-600/10 text-blue-600",
  },
];
