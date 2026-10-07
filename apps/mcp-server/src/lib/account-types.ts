/**
 * Satu-satunya tempat union type `AccountType` didefinisikan di app ini
 * (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
 * #6) — begitu tipe akun ketiga ditambahkan, cukup edit file ini, bukan
 * grep 2+ lokasi tersebar.
 */
export type AccountType = "cash" | "debt" | "investment";

export const ACCOUNT_TYPES = ["cash", "debt", "investment"] as const satisfies readonly AccountType[];
