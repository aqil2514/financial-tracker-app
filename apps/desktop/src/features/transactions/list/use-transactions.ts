import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";
import { toPagination } from "@/lib/pagination";
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

export function useTransactions(
  page: number,
  limit: number,
  types: Transaction["type"][] = [],
  date?: string,
  sort: TransactionSort = "date_desc",
  noteFilters: FilterConfig[] = []
) {
  return useQuery({
    queryKey: [...transactionsQueryKey, page, limit, types, date, sort, noteFilters],
    queryFn: async () => {
      const db = await getDb();
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (types.length > 0) {
        conditions.push(`type IN (${types.map((_, i) => `$${i + 1}`).join(", ")})`);
        params.push(...types);
      }
      if (date) {
        conditions.push(`date(date) = $${params.length + 1}`);
        params.push(date);
      }
      for (const filter of noteFilters) {
        if (filter.filterKey !== "note") continue;

        if (filter.filterOperator === "is_null") {
          conditions.push("note IS NULL");
        } else if (filter.filterOperator === "is_not_null") {
          conditions.push("note IS NOT NULL");
        } else if (typeof filter.filterValue === "string" && filter.filterValue !== "") {
          const notPrefix = filter.filterOperator === "not_ilike" ? "NOT " : "";
          conditions.push(`${notPrefix}note LIKE $${params.length + 1}`);
          params.push(`%${filter.filterValue}%`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
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
