import { toPagination } from "@/lib/pagination";
import type { TransactionListRow } from "./interface";

export const toTransactionsPageResult = (
  rows: TransactionListRow[],
  countResult: { total: number }[],
  page: number,
  limit: number
) => ({
  transactions: rows,
  pagination: toPagination(countResult[0]?.total ?? 0, page, limit),
});
