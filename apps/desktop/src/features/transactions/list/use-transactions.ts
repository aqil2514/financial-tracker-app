import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";
import { toPagination } from "@/lib/pagination";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { ExtraCondition } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { buildOrderClause } from "@/components/query/sort/builders/sql";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { buildLimitOffset } from "@/components/query/pagination/builders/sql";

export const transactionsQueryKey = ["transactions"];

const DEFAULT_ORDER_CLAUSE = "date DESC, id DESC";

// Kolom transactions yang boleh muncul sebagai filterKey — harus
// sinkron dengan FILTER_CONFIG di transaction-list.tsx.
const FILTERABLE_COLUMNS = [
  "note",
  "description",
  "type",
  "category_id",
  "account_id",
  "amount",
] as const;

const HAS_ATTACHMENT_SUBQUERY =
  "EXISTS (SELECT 1 FROM transaction_attachments WHERE transaction_attachments.transaction_id = transactions.id)";

/** Transaction hasil query list — punya `has_attachment` tambahan (dari
 * subquery EXISTS) supaya card list bisa menampilkan indikator lampiran
 * tanpa query terpisah per-item (hindari N+1). SQLite mengembalikan hasil
 * EXISTS sebagai 0/1, bukan boolean. */
export type TransactionListRow = Transaction & { has_attachment: number };

/**
 * `has_attachment` bukan kolom asli `transactions` (lampiran ada di tabel
 * terpisah `transaction_attachments`), jadi tidak bisa lewat
 * `buildWhereClause` generik yang mengasumsikan `filterKey` = nama kolom.
 * Disaring lebih dulu di sini dan diterjemahkan jadi kondisi
 * EXISTS/NOT EXISTS lewat `extraConditions`, sebelum sisa filter lain
 * diproses seperti biasa.
 */
function extractAttachmentCondition(filters: FilterConfig[]): {
  remaining: FilterConfig[];
  extraConditions: ExtraCondition[];
} {
  const remaining: FilterConfig[] = [];
  const extraConditions: ExtraCondition[] = [];

  for (const filter of filters) {
    if (filter.filterKey !== "has_attachment") {
      remaining.push(filter);
      continue;
    }

    const values = Array.isArray(filter.filterValue)
      ? filter.filterValue.map(String)
      : filter.filterValue != null
        ? [String(filter.filterValue)]
        : [];
    // Dua nilai sekaligus (Ada + Tidak ada) berarti tidak memfilter apa-apa.
    if (values.length !== 1) continue;

    extraConditions.push({
      condition: values[0] === "1" ? HAS_ATTACHMENT_SUBQUERY : `NOT ${HAS_ATTACHMENT_SUBQUERY}`,
    });
  }

  return { remaining, extraConditions };
}

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

      const { remaining, extraConditions } = extractAttachmentCondition(filters);
      const { whereClause, params } = buildWhereClause(remaining, FILTERABLE_COLUMNS, [
        ...(date ? [{ condition: "date(date) = $1", params: [date] }] : []),
        ...extraConditions,
      ]);

      const orderClause = buildOrderClause(sorts, SORTABLE_COLUMNS, DEFAULT_ORDER_CLAUSE);
      const { clause: limitOffsetClause, params: limitOffsetParams } = buildLimitOffset(
        page,
        limit,
        params.length + 1
      );

      const [rows, countResult] = await Promise.all([
        db.select<TransactionListRow[]>(
          `SELECT transactions.*, ${HAS_ATTACHMENT_SUBQUERY} as has_attachment
           FROM transactions ${whereClause} ${orderClause} ${limitOffsetClause}`,
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
