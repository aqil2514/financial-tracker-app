import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type CashflowBreakdownRow = {
  // ID grup akun (account_groups.id) atau ID kategori induk
  // (categories.id, kategori yg TIDAK punya parent_id) -- null utk
  // bucket "Tanpa Grup"/"Tanpa Kategori". Dipakai buat filter transaksi
  // presisi di dialog drill-down (bukan match by label yg ambigu).
  group_key: string | null;
  label: string;
  total: number;
};

export type CashflowGroupBy = "account_group" | "parent_category";

export const cashflowBreakdownQueryKey = ["reports", "cashflow-breakdown"];

// Dua dimensi breakdown yang bisa dipilih user: per grup akun (default,
// account_groups) atau per kategori induk (kategori tanpa parent_id
// dipakai namanya sendiri; kategori anak digabung ke nama induknya;
// transaksi tanpa kategori -> "Tanpa Kategori"). Query account_group
// JOIN ke accounts (account_id), query parent_category JOIN ke
// categories + self-join ke induknya (category_id). GROUP BY pakai id
// (bukan nama) supaya 2 grup/kategori beda id tapi nama kebetulan sama
// tidak tergabung keliru.
const QUERY_BY_GROUP_BY: Record<CashflowGroupBy, string> = {
  account_group: `
    SELECT g.id as group_key, COALESCE(g.name, 'Tanpa Grup') as label, SUM(t.amount) as total
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN account_groups g ON g.id = a.group_id
    WHERE t.type = $1 AND date(t.date) BETWEEN $2 AND $3
    GROUP BY g.id
    ORDER BY total DESC
  `,
  parent_category: `
    SELECT
      COALESCE(parent.id, c.id) as group_key,
      COALESCE(parent.name, c.name, 'Tanpa Kategori') as label,
      SUM(t.amount) as total
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories parent ON parent.id = c.parent_id
    WHERE t.type = $1 AND date(t.date) BETWEEN $2 AND $3
    GROUP BY group_key
    ORDER BY total DESC
  `,
};

export function useCashflowBreakdown(
  from: string,
  to: string,
  type: "income" | "expense",
  groupBy: CashflowGroupBy
) {
  return useQuery({
    queryKey: [...cashflowBreakdownQueryKey, from, to, type, groupBy],
    queryFn: async () => {
      const db = await getDb();
      return db.select<CashflowBreakdownRow[]>(QUERY_BY_GROUP_BY[groupBy], [type, from, to]);
    },
  });
}
