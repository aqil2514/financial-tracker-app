/**
 * Satu-satunya tempat union type `AccountType` didefinisikan di app ini
 * (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
 * #6) — begitu tipe akun ketiga ditambahkan, cukup edit file ini, bukan
 * grep 6+ lokasi tersebar. CHECK constraint SQL (sekarang
 * schema/0002_account_type_investment.sql) tetap butuh migrasi baru
 * sendiri — tidak bisa di-reuse dari sini.
 *
 * **Revisi 2026-10-07 (docs/todos/plan/investment-sync.md, Tahap 2)**:
 * `"investment"` ditambah, menyusul desktop yang sudah mendukungnya
 * penuh (`apps/desktop/src/lib/account-types.ts`).
 */
export type AccountType = "cash" | "debt" | "investment";

export const ACCOUNT_TYPES = ["cash", "debt", "investment"] as const satisfies readonly AccountType[];

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
 * accounts/service.ts (correctAccountBalance).
 *
 * **Revisi 2026-10-07**: `"investment"` ditambah -- saldo akun investment
 * py data turunan serupa (`investment_purchases`/`investment_sales`,
 * lahir dari transfer lewat applyInvestmentTransaction), koreksi saldo
 * manual langsung thd akun ini akan membuat `accounts.balance` tidak
 * lagi mencerminkan riwayat pembelian/penjualan yang tersimpan.
 */
const ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION: readonly AccountType[] = ["debt", "investment"];

export function isAccountTypeRestrictedFromDirectTransaction(accountType: string): boolean {
  return (ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION as readonly string[]).includes(accountType);
}
