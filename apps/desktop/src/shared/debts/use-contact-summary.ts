import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import { buildWhereClause, type ExtraCondition } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { buildOrderClause } from "@/components/query/sort/builders/sql";
import type { SortConfig } from "@/components/query/sort/sort.interface";

export const contactSummaryQueryKey = ["debts", "contact-summary"];

// Kolom yang boleh dipakai FilterPanel biasa (lewat buildWhereClause).
// "debt_kind" SENGAJA tidak dimasukkan — butuh OR lintas 2 kolom
// computed (has_receivable/has_payable), ditangani manual di bawah
// sebagai ExtraCondition, bukan lewat allowedColumns generik.
const FILTERABLE_COLUMNS = ["contact_name", "remaining_status"] as const;

// Kolom yang boleh dipakai SortDropdown — harus sinkron dengan
// SORT_CONFIG di contact-summary-sort.tsx. Semua alias dari subquery
// `wrapped`/`baseSelect` di bawah, aman dipakai ORDER BY di level
// terluar (beda dari WHERE, ORDER BY tidak butuh subquery-wrap lagi).
const SORTABLE_COLUMNS = [
  "contact_name",
  "receivable_remaining",
  "payable_remaining",
  "receivable_active",
  "payable_active",
] as const;
const DEFAULT_ORDER_CLAUSE = "contact_name COLLATE NOCASE";

export type ContactDebtSummary = {
  contact_id: string;
  contact_name: string;
  /** Total POKOK piutang ONGOING milik kontak ini (sebelum dikurangi
   * cicilan yang sudah masuk). 0 kalau tidak ada piutang ongoing. */
  receivable_active: number;
  /** Total yang SUDAH dibayar dari piutang ongoing di atas. */
  receivable_paid: number;
  /** Sisa piutang ONGOING (= receivable_active - receivable_paid) — uang
   * yang masih harus dikembalikan ke saya. 0 kalau tidak ada. */
  receivable_remaining: number;
  /** Total POKOK utang ONGOING ke kontak ini. 0 kalau tidak ada utang
   * ongoing. */
  payable_active: number;
  /** Total yang SUDAH dibayar dari utang ongoing di atas. */
  payable_paid: number;
  /** Sisa utang ONGOING (= payable_active - payable_paid) — uang yang
   * masih harus saya kembalikan. 0 kalau tidak ada. */
  payable_remaining: number;
};

/** "Jenis" (Piutang/Utang) butuh OR lintas 2 kolom computed berbeda
 * (has_receivable/has_payable) — tidak bisa lewat buildWhereClause
 * generik yang bekerja per-1-kolom, jadi diekstrak manual di sini jadi
 * ExtraCondition sebelum sisanya (nama, status pelunasan) diproses
 * buildWhereClause seperti biasa. Value filter berisi subset dari
 * ["receivable", "payable"] (multi-select "select" field, OR/union
 * sesuai keputusan produk — kontak muncul kalau punya SALAH SATU jenis
 * yang dicentang).
 */
function extractDebtKindCondition(filters: FilterConfig[]): {
  condition: ExtraCondition | null;
  rest: FilterConfig[];
} {
  const debtKindFilter = filters.find((f) => f.filterKey === "debt_kind");
  const rest = filters.filter((f) => f.filterKey !== "debt_kind");

  if (!debtKindFilter) return { condition: null, rest };

  const kinds = Array.isArray(debtKindFilter.filterValue)
    ? debtKindFilter.filterValue.map(String)
    : [];
  const columns = kinds
    .map((kind) =>
      kind === "receivable" ? "has_receivable" : kind === "payable" ? "has_payable" : null
    )
    .filter((col): col is "has_receivable" | "has_payable" => col != null);

  if (columns.length === 0) return { condition: null, rest };

  return {
    condition: { condition: `(${columns.map((col) => `${col} = 1`).join(" OR ")})` },
    rest,
  };
}

/** Rangkuman per kontak — tujuan inti fitur ini (lihat "Masalah inti" di
 * debt-receivable-tracking.md): jawab "si X total masih pinjam berapa ke
 * saya sekarang" tanpa jumlah manual. Cuma kontak yang PERNAH punya
 * piutang/utang (join lewat debts) yang muncul di sini.
 *
 * `filters` mendukung 3 field (lihat header/index.tsx): "contact_name"
 * (text, ilike), "debt_kind" (select multi: receivable/payable, OR),
 * "remaining_status" (select: has_remaining/settled). Kolom computed
 * (has_receivable/has_payable/remaining_status) tidak bisa difilter di
 * level SELECT yang sama tempat dia didefinisikan (batasan SQLite),
 * jadi query dasar dibungkus subquery dulu — sama pola dengan
 * `BALANCE_EXPRESSION` di use-accounts-paginated.ts. */
export function useContactSummary(filters: FilterConfig[] = [], sorts: SortConfig[] = []) {
  return useQuery({
    queryKey: [...contactSummaryQueryKey, filters, sorts],
    queryFn: async (): Promise<ContactDebtSummary[]> => {
      const db = await getDb();

      const { condition: debtKindCondition, rest: otherFilters } = extractDebtKindCondition(filters);
      const { whereClause, params } = buildWhereClause(
        otherFilters,
        FILTERABLE_COLUMNS,
        debtKindCondition ? [debtKindCondition] : []
      );
      const orderClause = buildOrderClause(sorts, SORTABLE_COLUMNS, DEFAULT_ORDER_CLAUSE);

      const baseSelect = `SELECT
           contacts.id AS contact_id,
           contacts.name AS contact_name,
           COALESCE((
             SELECT SUM(debts.amount) FROM debts
             WHERE debts.contact_id = contacts.id
               AND debts.type = 'receivable'
               AND debts.status = 'ongoing'
               AND debts.deleted_at IS NULL
           ), 0) AS receivable_active,
           COALESCE((
             SELECT SUM(debt_payments.amount)
             FROM debt_payments
             JOIN debts ON debts.id = debt_payments.debt_id
             WHERE debts.contact_id = contacts.id
               AND debts.type = 'receivable'
               AND debts.status = 'ongoing'
               AND debts.deleted_at IS NULL
               AND debt_payments.deleted_at IS NULL
           ), 0) AS receivable_paid,
           COALESCE((
             SELECT SUM(
               debts.amount - COALESCE(
                 (SELECT SUM(amount) FROM debt_payments
                  WHERE debt_payments.debt_id = debts.id AND debt_payments.deleted_at IS NULL),
                 0
               )
             )
             FROM debts
             WHERE debts.contact_id = contacts.id
               AND debts.type = 'receivable'
               AND debts.status = 'ongoing'
               AND debts.deleted_at IS NULL
           ), 0) AS receivable_remaining,
           COALESCE((
             SELECT SUM(debts.amount) FROM debts
             WHERE debts.contact_id = contacts.id
               AND debts.type = 'payable'
               AND debts.status = 'ongoing'
               AND debts.deleted_at IS NULL
           ), 0) AS payable_active,
           COALESCE((
             SELECT SUM(debt_payments.amount)
             FROM debt_payments
             JOIN debts ON debts.id = debt_payments.debt_id
             WHERE debts.contact_id = contacts.id
               AND debts.type = 'payable'
               AND debts.status = 'ongoing'
               AND debts.deleted_at IS NULL
               AND debt_payments.deleted_at IS NULL
           ), 0) AS payable_paid,
           COALESCE((
             SELECT SUM(
               debts.amount - COALESCE(
                 (SELECT SUM(amount) FROM debt_payments
                  WHERE debt_payments.debt_id = debts.id AND debt_payments.deleted_at IS NULL),
                 0
               )
             )
             FROM debts
             WHERE debts.contact_id = contacts.id
               AND debts.type = 'payable'
               AND debts.status = 'ongoing'
               AND debts.deleted_at IS NULL
           ), 0) AS payable_remaining
         FROM contacts
         WHERE EXISTS (SELECT 1 FROM debts WHERE debts.contact_id = contacts.id AND debts.deleted_at IS NULL)`;

      const wrapped = `SELECT *,
           CASE WHEN receivable_active > 0 THEN 1 ELSE 0 END AS has_receivable,
           CASE WHEN payable_active > 0 THEN 1 ELSE 0 END AS has_payable,
           CASE WHEN (receivable_remaining + payable_remaining) > 0 THEN 'has_remaining' ELSE 'settled' END AS remaining_status
         FROM (${baseSelect})`;

      return db.select<ContactDebtSummary[]>(
        `SELECT * FROM (${wrapped}) AS contact_summary ${whereClause} ${orderClause}`,
        params
      );
    },
  });
}
