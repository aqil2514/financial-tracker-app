import { getDb } from "@/lib/db";
import { HAS_ATTACHMENT_SUBQUERY, type TransactionListRow } from "./interface";

type Db = Awaited<ReturnType<typeof getDb>>;

export const runTransactionsQueries = (
  db: Db,
  clauses: {
    whereClause: string;
    params: unknown[];
    orderClause: string;
    limitOffsetClause: string;
    limitOffsetParams: unknown[];
  }
) =>
  Promise.all([
    db.select<TransactionListRow[]>(
      `SELECT transactions.*, ${HAS_ATTACHMENT_SUBQUERY} as has_attachment
       FROM transactions ${clauses.whereClause} ${clauses.orderClause} ${clauses.limitOffsetClause}`,
      [...clauses.params, ...clauses.limitOffsetParams]
    ),
    db.select<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM transactions ${clauses.whereClause}`,
      clauses.params
    ),
  ]);
