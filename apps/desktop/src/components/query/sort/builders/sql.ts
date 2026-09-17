import type { SortConfig } from "../sort.interface";

/**
 * Menerjemahkan SortConfig[] jadi klausa `ORDER BY ...` siap disisipkan
 * ke query SQLite — sudah termasuk kata "ORDER BY " (atau `defaultClause`
 * kalau `sorts` kosong).
 *
 * Sama seperti `buildWhereClause`: `sortKey` disisipkan LANGSUNG sebagai
 * nama kolom SQL (tidak bisa di-bind sebagai parameter), jadi WAJIB
 * divalidasi lewat `allowedColumns` untuk mencegah SQL injection lewat
 * nama kolom. `sortKey` di luar daftar itu akan melempar error, bukan
 * diam-diam diloloskan.
 *
 * Mendukung multi-sort — beberapa SortConfig sekaligus jadi
 * `ORDER BY colA ASC, colB DESC`.
 */
export function buildOrderClause(
  sorts: SortConfig[],
  allowedColumns: readonly string[],
  defaultClause: string
): string {
  if (sorts.length === 0) return `ORDER BY ${defaultClause}`;

  const clauses = sorts.map(({ sortKey, sortDirection }) => {
    if (!allowedColumns.includes(sortKey)) {
      throw new Error(
        `[buildOrderClause] Kolom "${sortKey}" tidak ada di allowedColumns. ` +
          `Pastikan SortKeyOption dan allowedColumns memakai nama kolom yang sama persis.`
      );
    }
    const direction = sortDirection === "asc" ? "ASC" : "DESC";
    return `${sortKey} ${direction}`;
  });

  return `ORDER BY ${clauses.join(", ")}`;
}
