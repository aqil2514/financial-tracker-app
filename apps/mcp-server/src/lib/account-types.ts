/**
 * Satu-satunya tempat union type `AccountType` didefinisikan di app ini
 * (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
 * #6) — begitu tipe akun ketiga ditambahkan, cukup edit file ini, bukan
 * grep 2+ lokasi tersebar.
 */
export type AccountType = "cash" | "debt";

export const ACCOUNT_TYPES = ["cash", "debt"] as const satisfies readonly AccountType[];
