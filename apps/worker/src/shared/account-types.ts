/**
 * Satu-satunya tempat union type `AccountType` didefinisikan di app ini
 * (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
 * #6) — begitu tipe akun ketiga ditambahkan, cukup edit file ini, bukan
 * grep 6+ lokasi tersebar. CHECK constraint SQL (schema/0001_initial.sql)
 * tetap butuh migrasi baru sendiri — tidak bisa di-reuse dari sini.
 */
export type AccountType = "cash" | "debt";

export const ACCOUNT_TYPES = ["cash", "debt"] as const satisfies readonly AccountType[];

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === "string" && (ACCOUNT_TYPES as readonly string[]).includes(value);
}

/**
 * Tipe akun yang saldonya derived dari tabel lain (bukan nilai bebas),
 * jadi tidak boleh disentuh lewat `correctAccountBalance` (koreksi
 * saldo manual) -- jalur itu INSERT transaksi langsung TANPA lewat
 * applyDebtTransaction, jadi data turunan (mis. `debts`/`debt_payments`
 * utk "debt") tidak ikut disesuaikan kalau diizinkan. income/expense
 * BIASA (lewat createTransactionRow/updateTransactionRow) ke tipe akun
 * ini TETAP sah -- docs/concept/konsep-transaksi.md menegaskan
 * income/expense/transfer sama-sama sah merepresentasikan perubahan
 * nilai akun apa pun (termasuk "kas virtual" debt yg bertambah/berkurang
 * individual tanpa pasangan transfer), tidak dibatasi harus transfer.
 * Satu-satunya tempat daftar ini didefinisikan (lihat
 * docs/todos/plan/titik-rawan-tipe-akun.md #2 & #3) -- dipakai di
 * accounts/service.ts (correctAccountBalance). Nambah tipe akun baru yg
 * punya data turunan serupa (mis. "investment") = tambah ke sini.
 */
const ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION: readonly AccountType[] = ["debt"];

export function isAccountTypeRestrictedFromDirectTransaction(accountType: string): boolean {
  return (ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION as readonly string[]).includes(accountType);
}
