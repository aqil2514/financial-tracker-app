import { useQuery } from "@tanstack/react-query";
import { getDb, type Account } from "@/lib/db";
import type { AccountWithBalance } from "./calculate-balance";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { buildOrderClause } from "@/components/query/sort/builders/sql";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { buildLimitOffset } from "@/components/query/pagination/builders/sql";
import { toPagination, type Pagination } from "@/lib/pagination";
import { accountsQueryKey } from "@/hooks/resources/use-accounts";

const DEFAULT_ORDER_CLAUSE = "name COLLATE NOCASE";

// `balance` bukan kolom SQL asli — dihitung lewat subquery agregat yang
// meniru logika calculateAccountBalance() (initial_balance + income -
// expense - transfer keluar + transfer masuk), dipasang sebagai alias
// SELECT supaya bisa dipakai di ORDER BY dan (lewat HAVING) di filter.
const BALANCE_EXPRESSION = `(
  accounts.initial_balance
  + COALESCE((
      SELECT SUM(
        CASE
          WHEN t.type = 'income' THEN t.amount
          WHEN t.type = 'expense' THEN -t.amount
          WHEN t.type = 'transfer' THEN -t.amount
          ELSE 0
        END
      )
      FROM transactions t
      WHERE t.account_id = accounts.id
    ), 0)
  + COALESCE((
      SELECT SUM(t.amount)
      FROM transactions t
      WHERE t.type = 'transfer' AND t.transfer_account_id = accounts.id
    ), 0)
)`;

type AccountRow = Account & { balance: number; group_name: string | null };

// Kolom accounts yang boleh muncul sebagai filterKey — harus
// sinkron dengan FILTER_CONFIG di header/index.tsx.
const FILTERABLE_COLUMNS = ["name", "group_id", "initial_balance"] as const;
const BALANCE_FILTER_COLUMN = "balance" as const;

// Kolom accounts yang boleh muncul sebagai sortKey — harus
// sinkron dengan SORT_CONFIG di header/index.tsx. `group_name` adalah
// alias dari LEFT JOIN account_groups, bukan kolom tabel accounts, tapi
// tetap valid dipakai di ORDER BY.
const SORTABLE_COLUMNS = ["name", "initial_balance", "created_at", "balance", "group_name"] as const;

export interface AccountsListResult {
  accounts: AccountWithBalance[];
  pagination: Pagination;
}

export function useAccountsPaginated(
  page: number,
  limit: number,
  sorts: SortConfig[] = [],
  filters: FilterConfig[] = []
) {
  return useQuery({
    queryKey: [...accountsQueryKey, "paginated", page, limit, sorts, filters],
    queryFn: async (): Promise<AccountsListResult> => {
      const db = await getDb();

      const columnFilters = filters.filter((f) => f.filterKey !== BALANCE_FILTER_COLUMN);
      const balanceFilters = filters.filter((f) => f.filterKey === BALANCE_FILTER_COLUMN);

      const { whereClause, params } = buildWhereClause(columnFilters, FILTERABLE_COLUMNS);
      const { whereClause: balanceHavingClause, params: balanceParams } = buildWhereClause(
        balanceFilters,
        [BALANCE_FILTER_COLUMN],
        [],
        params.length + 1
      );
      const havingClause = balanceHavingClause.replace(/^WHERE/, "HAVING");

      const orderClause = buildOrderClause(sorts, SORTABLE_COLUMNS, DEFAULT_ORDER_CLAUSE);

      const combinedParams = [...params, ...balanceParams];
      const { clause: limitOffsetClause, params: limitOffsetParams } = buildLimitOffset(
        page,
        limit,
        combinedParams.length + 1
      );

      const selectWithBalance = `SELECT accounts.*, ${BALANCE_EXPRESSION} AS balance, account_groups.name AS group_name
         FROM accounts
         LEFT JOIN account_groups ON account_groups.id = accounts.group_id
         ${whereClause}
         ${havingClause}`;

      const [accounts, countResult] = await Promise.all([
        db.select<AccountRow[]>(
          `${selectWithBalance} ${orderClause} ${limitOffsetClause}`,
          [...combinedParams, ...limitOffsetParams]
        ),
        db.select<{ total: number }[]>(
          `SELECT COUNT(*) as total FROM (${selectWithBalance})`,
          combinedParams
        ),
      ]);

      return {
        accounts,
        pagination: toPagination(countResult[0]?.total ?? 0, page, limit),
      };
    },
  });
}
