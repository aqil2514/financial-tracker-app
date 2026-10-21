/**
 * Satu-satunya tempat union type `AccountType` didefinisikan di app ini
 * (lihat docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan
 * #6) — begitu tipe akun ketiga ditambahkan, cukup edit file ini, bukan
 * grep 2+ lokasi tersebar.
 *
 * **Revisi 2026-10-21 (docs/todos/plan/third-party-sync.md, Tahap 4)**:
 * `"third_party"` ditambah -- file Worker yang setara (`shared/account-types.ts`)
 * SEMPAT terlewat juga di Tahap 1/2/3 sampai ketahuan lewat dogfooding
 * nyata (`POST /accounts` 400), dicek proaktif di sini SEBELUM terjadi
 * lagi di MCP.
 */
export type AccountType = "cash" | "debt" | "investment" | "third_party";

export const ACCOUNT_TYPES = ["cash", "debt", "investment", "third_party"] as const satisfies readonly AccountType[];
