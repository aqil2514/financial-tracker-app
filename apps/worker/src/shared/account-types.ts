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
 *
 * **Revisi 2026-10-21 (docs/todos/plan/third-party-sync.md, Tahap 3)**:
 * `"third_party"` ditambah -- gap ditemukan lewat dogfooding (push akun
 * `third_party` dari desktop ditolak `POST /accounts` 400, padahal
 * skema D1 + `classifyAccountPair` sudah mendukung sejak Tahap 1/2).
 * File ini TIDAK ikut diperbarui saat Tahap 1/2 krn union di sini
 * dipakai validasi PAYLOAD (`isAccountPayload`), bukan skema/transfer --
 * celah yang sama persis diperingatkan di komentar atas (6+ lokasi
 * tersebar), terbukti nyata di sini.
 */
export type AccountType = "cash" | "debt" | "investment" | "third_party";

export const ACCOUNT_TYPES = ["cash", "debt", "investment", "third_party"] as const satisfies readonly AccountType[];

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
 *
 * **Revisi 2026-10-21 (docs/todos/plan/third-party-sync.md, Tahap 3)**:
 * `"third_party"` ditambah -- saldo akun ini py data turunan serupa
 * (`third_party_funds`, lahir dari `applyDirectThirdPartyTransaction`),
 * sama alasan dgn debt/investment. Port dari guard
 * `ACCOUNT_TYPES_RESTRICTED_FROM_BALANCE_CORRECTION` desktop
 * (`lib/account-types.ts`, ditambahkan sesi sebelumnya).
 */
const ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION: readonly AccountType[] = ["debt", "investment", "third_party"];

export function isAccountTypeRestrictedFromDirectTransaction(accountType: string): boolean {
  return (ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION as readonly string[]).includes(accountType);
}
