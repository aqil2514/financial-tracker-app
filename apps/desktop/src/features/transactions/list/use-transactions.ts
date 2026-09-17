import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";
import { toPagination } from "@/lib/pagination";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { buildOrderClause } from "@/components/query/sort/builders/sql";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { buildLimitOffset } from "@/components/query/pagination/builders/sql";

export const transactionsQueryKey = ["transactions"];

const DEFAULT_ORDER_CLAUSE = "date DESC, id DESC";

// Kolom transactions yang boleh muncul sebagai filterKey — harus
// sinkron dengan FILTER_CONFIG di transaction-list.tsx.
const FILTERABLE_COLUMNS = ["note", "type", "category_id", "account_id", "amount"] as const;

// Kolom transactions yang boleh muncul sebagai sortKey — harus
// sinkron dengan SORT_CONFIG di list-card-header.tsx.
const SORTABLE_COLUMNS = ["date", "amount"] as const;

export function useTransactions(
  page: number,
  limit: number,
  date?: string,
  sorts: SortConfig[] = [],
  filters: FilterConfig[] = []
) {
  return useQuery({
    queryKey: [...transactionsQueryKey, page, limit, date, sorts, filters],
    queryFn: async () => {
      const db = await getDb();

      const { whereClause, params } = buildWhereClause(
        filters,
        FILTERABLE_COLUMNS,
        date ? [{ condition: "date(date) = $1", params: [date] }] : []
      );

      const orderClause = buildOrderClause(sorts, SORTABLE_COLUMNS, DEFAULT_ORDER_CLAUSE);
      const { clause: limitOffsetClause, params: limitOffsetParams } = buildLimitOffset(
        page,
        limit,
        params.length + 1
      );

      const [rows, countResult] = await Promise.all([
        db.select<Transaction[]>(
          `SELECT * FROM transactions ${whereClause} ${orderClause} ${limitOffsetClause}`,
          [...params, ...limitOffsetParams]
        ),
        db.select<{ total: number }[]>(
          `SELECT COUNT(*) as total FROM transactions ${whereClause}`,
          params
        ),
      ]);

      return {
        transactions: rows,
        pagination: toPagination(countResult[0]?.total ?? 0, page, limit),
      };
    },
  });
}
