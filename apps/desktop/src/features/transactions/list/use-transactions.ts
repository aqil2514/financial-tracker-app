import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";
import { toPagination } from "@/lib/pagination";
import { buildWhereClause } from "@/components/filters/builders/sql";
import type { FilterConfig } from "@/components/filters/filter.interface";

export const transactionsQueryKey = ["transactions"];

export type TransactionSort =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc";

const SORT_CLAUSES: Record<TransactionSort, string> = {
  date_desc: "date DESC, id DESC",
  date_asc: "date ASC, id ASC",
  amount_desc: "amount DESC, id DESC",
  amount_asc: "amount ASC, id ASC",
};

// Kolom transactions yang boleh muncul sebagai filterKey — harus
// sinkron dengan FILTER_CONFIG di transaction-list.tsx.
const FILTERABLE_COLUMNS = ["note", "type"] as const;

export function useTransactions(
  page: number,
  limit: number,
  date?: string,
  sort: TransactionSort = "date_desc",
  filters: FilterConfig[] = []
) {
  return useQuery({
    queryKey: [...transactionsQueryKey, page, limit, date, sort, filters],
    queryFn: async () => {
      const db = await getDb();
      const offset = (page - 1) * limit;

      const { whereClause, params } = buildWhereClause(
        filters,
        FILTERABLE_COLUMNS,
        date ? [{ condition: "date(date) = $1", params: [date] }] : []
      );

      const orderClause = SORT_CLAUSES[sort];

      const [rows, countResult] = await Promise.all([
        db.select<Transaction[]>(
          `SELECT * FROM transactions ${whereClause} ORDER BY ${orderClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
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
