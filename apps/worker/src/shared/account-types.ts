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
