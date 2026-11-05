import type { FilterConfig } from "@/components/query/filters/filter.interface";

export type Granularity = "day" | "week" | "month" | "year";

export interface BalanceTrendFilter {
  accountTypes: string[];
  groupIds: string[];
  accountIds: string[];
}

export interface BalanceTrendPoint {
  label: string;
  balance: number;
}

// Format strftime SQLite per granularitas untuk GROUP BY titik waktu. "week" memakai %Y-%W
// (minggu ke-N dalam tahun) karena SQLite tidak punya format ISO-week bawaan. Nilainya
// whitelist literal, aman disisipkan ke SQL.
const STRFTIME_FORMAT: Record<Granularity, string> = {
  day: "%Y-%m-%d",
  week: "%Y-%W",
  month: "%Y-%m",
  year: "%Y",
};

// FilterPanel generik mengembalikan FilterConfig[]; di sini hanya operator "eq" yang dipakai
// (ketiga filter hanya INCLUDE, tidak ada mode exclude), sama seperti desktop.
export function toBalanceTrendFilter(filters: FilterConfig[]): BalanceTrendFilter {
  const valuesOf = (key: string): string[] => {
    const match = filters.find((f) => f.filterKey === key && f.filterOperator === "eq");
    return Array.isArray(match?.filterValue) ? match.filterValue.map(String) : [];
  };

  return {
    accountTypes: valuesOf("account_type"),
    groupIds: valuesOf("group_id"),
    accountIds: valuesOf("account_id"),
  };
}

// Kondisi tambahan terhadap tabel accounts `a`. Ketiga filter opsional dan saling AND.
// Akun nonaktif dikecualikan SECARA DEFAULT (saat tidak ada akun spesifik dipilih); kalau
// pengguna sengaja memilih akun tertentu (termasuk yang nonaktif), syarat is_active dilepas
// supaya pilihan eksplisit itu tetap terhitung.
export function buildAccountFilter(filter: BalanceTrendFilter): { sql: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];

  if (filter.accountIds.length === 0) conditions.push("a.is_active = 1");

  const addIn = (column: string, values: string[]) => {
    if (values.length === 0) return;
    conditions.push(`${column} IN (${values.map(() => "?").join(", ")})`);
    params.push(...values);
  };
  addIn("a.account_type", filter.accountTypes);
  addIn("a.group_id", filter.groupIds);
  addIn("a.id", filter.accountIds);

  return { sql: conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "", params };
}

// Saldo awal: initial_balance + seluruh transaksi akun terfilter SEBELUM tanggal `from`.
export function buildOpeningQuery(from: string, filter: BalanceTrendFilter) {
  const account = buildAccountFilter(filter);
  return {
    sql: `SELECT COALESCE(SUM(
        a.initial_balance
          + COALESCE((SELECT SUM(CASE
              WHEN t.type = 'income' THEN t.amount
              WHEN t.type = 'expense' THEN -t.amount
              WHEN t.type = 'transfer' THEN -t.amount
              ELSE 0
            END) FROM transactions t WHERE t.account_id = a.id AND date(t.date) < ?), 0)
          + COALESCE((SELECT SUM(t.amount) FROM transactions t
              WHERE t.type = 'transfer' AND t.transfer_account_id = a.id AND date(t.date) < ?), 0)
      ), 0) AS balance
      FROM accounts a
      WHERE 1=1 ${account.sql}`,
    params: [from, from, ...account.params],
  };
}

// Perubahan bersih per titik waktu dalam rentang from..to. Dua SELECT (transaksi langsung di
// akun + transfer masuk dari akun lain) di-UNION ALL lalu di-GROUP BY ulang; saldo berjalan
// dihitung di JS, bukan re-SUM tiap titik dari awal waktu.
export function buildSeriesQuery(
  from: string,
  to: string,
  granularity: Granularity,
  filter: BalanceTrendFilter
) {
  const format = STRFTIME_FORMAT[granularity];
  const account = buildAccountFilter(filter);

  return {
    sql: `SELECT point, SUM(net) AS net FROM (
        SELECT strftime('${format}', t.date) AS point,
          CASE
            WHEN t.type = 'income' THEN t.amount
            WHEN t.type = 'expense' THEN -t.amount
            WHEN t.type = 'transfer' THEN -t.amount
            ELSE 0
          END AS net
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE date(t.date) BETWEEN ? AND ? ${account.sql}

        UNION ALL

        SELECT strftime('${format}', t.date) AS point, t.amount AS net
        FROM transactions t
        JOIN accounts a ON a.id = t.transfer_account_id
        WHERE t.type = 'transfer'
          AND date(t.date) BETWEEN ? AND ? ${account.sql}
      )
      GROUP BY point
      ORDER BY point ASC`,
    params: [from, to, ...account.params, from, to, ...account.params],
  };
}

export function toRunningBalance(
  openingBalance: number,
  rows: { point: string; net: number }[]
): BalanceTrendPoint[] {
  let running = openingBalance;
  return rows.map((row) => {
    running += row.net;
    return { label: row.point, balance: running };
  });
}
