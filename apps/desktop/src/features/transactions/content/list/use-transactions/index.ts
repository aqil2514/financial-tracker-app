import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { buildOrderClause } from "@/components/query/sort/builders/sql";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { buildLimitOffset } from "@/components/query/pagination/builders/sql";
import { buildWhereConditions } from "./build-where-conditions";
import { extractAttachmentCondition } from "./extract-attachment-condition";
import { runTransactionsQueries } from "./run-transactions-queries";
import { toTransactionsPageResult } from "./to-transactions-page-result";

export type { TransactionListRow } from "./interface";

export const transactionsQueryKey = ["transactions"];

const DEFAULT_ORDER_CLAUSE = "date DESC, id DESC";

// Kolom transactions yang boleh muncul sebagai sortKey — harus
// sinkron dengan SORT_CONFIG di list-card-header.tsx.
const SORTABLE_COLUMNS = ["date", "amount"] as const;

export function useTransactions(
  page: number,
  limit: number,
  date?: string,
  sorts: SortConfig[] = [],
  filters: FilterConfig[] = [],
  accountId?: number
) {
  return useQuery({
    queryKey: [...transactionsQueryKey, page, limit, date, sorts, filters, accountId],
    queryFn: async () => {
      // 1. Buka koneksi database.
      const db = await getDb();

      // 2. Pisahkan filter `has_attachment` (butuh EXISTS subquery) dari
      // filter kolom biasa.
      const { remaining, extraConditions } = extractAttachmentCondition(filters);

      // 3. Bangun klausa WHERE/ORDER BY/LIMIT OFFSET beserta parameternya.
      const { whereClause, params } = buildWhereConditions(
        remaining,
        date,
        extraConditions,
        accountId
      );
      const orderClause = buildOrderClause(sorts, SORTABLE_COLUMNS, DEFAULT_ORDER_CLAUSE);
      const { clause: limitOffsetClause, params: limitOffsetParams } = buildLimitOffset(
        page,
        limit,
        params.length + 1
      );

      // 4. Jalankan query baris + query total secara paralel.
      const [rows, countResult] = await runTransactionsQueries(db, {
        whereClause,
        params,
        orderClause,
        limitOffsetClause,
        limitOffsetParams,
      });

      // 5. Bentuk hasil: baris transaksi + info pagination dari total.
      return toTransactionsPageResult(rows, countResult, page, limit);
    },
  });
}
