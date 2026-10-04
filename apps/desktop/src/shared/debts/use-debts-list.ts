import { useQuery } from "@tanstack/react-query";
import { getDb, type Debt } from "@/lib/db";
import { buildLimitOffset } from "@/components/query/pagination/builders/sql";
import { buildWhereClause, type ExtraCondition } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { buildOrderClause } from "@/components/query/sort/builders/sql";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { toPagination, type Pagination } from "@/lib/pagination";

export const debtsListQueryKey = ["debts", "list"];

export type DebtListRow = Debt & {
  contact_name: string | null;
  account_name: string | null;
  remaining: number;
};

export interface DebtsListPaginatedResult {
  debts: DebtListRow[];
  pagination: Pagination;
}

const DEFAULT_ORDER_CLAUSE = "debts.date DESC, debts.id DESC";

// Kolom `debts` yang boleh muncul sebagai filterKey — harus sinkron
// dengan FILTER_CONFIG di header tabel. "has_payments" SENGAJA TIDAK
// masuk sini — bukan kolom biasa, ditangani manual lewat EXISTS/NOT
// EXISTS di bawah (lihat HAS_PAYMENTS_FILTER_KEY), karena
// buildWhereClause generik cuma bisa bandingkan satu kolom dengan
// operator biasa (eq/gt/between/dst), bukan subquery.
const FILTERABLE_COLUMNS = ["status", "contact_id", "account_id"] as const;

const HAS_PAYMENTS_FILTER_KEY = "has_payments";

// Kolom yang boleh muncul sebagai sortKey — harus sinkron dengan
// SORT_CONFIG di header tabel. `remaining` bukan kolom asli (alias
// subquery, lihat SELECT_WITH_REMAINING), tapi tetap valid dipakai di
// ORDER BY karena SQLite (beda dari WHERE) izinkan ORDER BY merujuk
// alias SELECT di level query yang sama.
const SORTABLE_COLUMNS = [
  "debts.date",
  "debts.amount",
  "remaining",
  "contact_name",
  "account_name",
] as const;

const SELECT_WITH_REMAINING = `SELECT
     debts.*,
     contacts.name AS contact_name,
     accounts.name AS account_name,
     debts.amount - COALESCE(
       (SELECT SUM(amount) FROM debt_payments
        WHERE debt_payments.debt_id = debts.id AND debt_payments.deleted_at IS NULL),
       0
     ) AS remaining
   FROM debts
   LEFT JOIN contacts ON contacts.id = debts.contact_id
   LEFT JOIN accounts ON accounts.id = debts.account_id`;

/** SEMUA `debts` dari satu `type`, TANPA paginasi/filter/sort — dipakai
 * `DebtsSummaryPageProvider` yang butuh keseluruhan data per kontak
 * (mis. `findOldestOngoing`), bukan tabel baris-per-baris. Untuk tabel
 * (`DebtListTable`), pakai `useDebtsList` (paginated) di bawah. */
export function useAllDebtsList(type: "receivable" | "payable") {
  return useQuery({
    queryKey: [...debtsListQueryKey, type, "all"],
    queryFn: async (): Promise<DebtListRow[]> => {
      const db = await getDb();
      return db.select<DebtListRow[]>(
        `${SELECT_WITH_REMAINING} WHERE debts.type = $1 AND debts.deleted_at IS NULL
         ORDER BY ${DEFAULT_ORDER_CLAUSE}`,
        [type]
      );
    },
  });
}

/** `debts` per `type`, dipaginasi+difilter+diurutkan di SQL (bukan
 * fetch semua lalu potong di client) supaya render `DebtListTable`
 * tidak berat begitu riwayatnya banyak. */
export function useDebtsList(
  type: "receivable" | "payable",
  page: number,
  limit: number,
  filters: FilterConfig[] = [],
  sorts: SortConfig[] = [],
  dateRange?: { from: string; to: string }
) {
  return useQuery({
    queryKey: [...debtsListQueryKey, type, page, limit, filters, sorts, dateRange],
    queryFn: async (): Promise<DebtsListPaginatedResult> => {
      const db = await getDb();

      // "Status Cicilan" (Sudah/Belum Dicicil) dipisah dari filters
      // biasa — ditangani manual sebagai EXISTS/NOT EXISTS, bukan
      // lewat buildWhereClause (lihat HAS_PAYMENTS_FILTER_KEY).
      // filterValue-nya array (FilterSelect mendukung multi-select &
      // operator eq/neq generik), tapi untuk filter biner ini cukup
      // ambil elemen pertama — operator neq/is_null/is_not_null/
      // multi-value TIDAK didukung di sini, sengaja disederhanakan
      // sampai memang ada kebutuhan nyata lebih dari "yes"/"no".
      const hasPaymentsFilter = filters.find((f) => f.filterKey === HAS_PAYMENTS_FILTER_KEY);
      const hasPaymentsValue = Array.isArray(hasPaymentsFilter?.filterValue)
        ? hasPaymentsFilter.filterValue[0]
        : undefined;
      const columnFilters = filters.filter((f) => f.filterKey !== HAS_PAYMENTS_FILTER_KEY);

      const EXISTS_PAYMENTS = `EXISTS (
        SELECT 1 FROM debt_payments
        WHERE debt_payments.debt_id = debts.id AND debt_payments.deleted_at IS NULL
      )`;
      const hasPaymentsCondition: ExtraCondition[] =
        hasPaymentsValue === "yes"
          ? [{ condition: EXISTS_PAYMENTS }]
          : hasPaymentsValue === "no"
            ? [{ condition: `NOT ${EXISTS_PAYMENTS}` }]
            : [];

      const typeCondition: ExtraCondition = { condition: "debts.type = $1", params: [type] };
      const deletedCondition: ExtraCondition = { condition: "debts.deleted_at IS NULL" };
      const dateRangeCondition: ExtraCondition[] = dateRange
        ? [
            {
              condition: `date(debts.date) BETWEEN $${2} AND $${3}`,
              params: [dateRange.from, dateRange.to],
            },
          ]
        : [];

      const { whereClause, params } = buildWhereClause(
        columnFilters,
        FILTERABLE_COLUMNS,
        [typeCondition, deletedCondition, ...dateRangeCondition, ...hasPaymentsCondition],
        1
      );

      const orderClause = buildOrderClause(sorts, SORTABLE_COLUMNS, DEFAULT_ORDER_CLAUSE);
      const { clause: limitOffsetClause, params: limitOffsetParams } = buildLimitOffset(
        page,
        limit,
        params.length + 1
      );

      const [debts, countResult] = await Promise.all([
        db.select<DebtListRow[]>(
          `${SELECT_WITH_REMAINING} ${whereClause} ${orderClause} ${limitOffsetClause}`,
          [...params, ...limitOffsetParams]
        ),
        db.select<{ total: number }[]>(
          `SELECT COUNT(*) as total FROM debts ${whereClause}`,
          params
        ),
      ]);

      return {
        debts,
        pagination: toPagination(countResult[0]?.total ?? 0, page, limit),
      };
    },
  });
}
