import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import { buildPrimaryEffectiveLabelSubquery } from "@/shared/labels/primary-label-subquery";

const PRIMARY_LABEL = buildPrimaryEffectiveLabelSubquery("t");

export type CashflowBreakdownRow = {
  // ID grup akun (account_groups.id) atau ID kategori induk
  // (categories.id, kategori yg TIDAK punya parent_id) -- null utk
  // bucket "Tanpa Grup"/"Tanpa Kategori". Dipakai buat filter transaksi
  // presisi di dialog drill-down (bukan match by label yg ambigu).
  // KHUSUS groupBy 'label' isinya NAMA label, bukan id -- label efektif
  // hasil fallback transaksi->kategori tidak punya satu id yg stabil
  // (bisa datang dari transaction_labels ATAU category_labels), dan nama
  // label sudah UNIQUE per scope jadi aman dipakai sbg kunci.
  group_key: string | null;
  label: string;
  total: number;
};

export type CashflowGroupBy = "account_group" | "parent_category" | "label";

export const cashflowBreakdownQueryKey = ["reports", "cashflow-breakdown"];

// Tiga dimensi breakdown yang bisa dipilih user: per grup akun (default,
// account_groups) atau per kategori induk (kategori tanpa parent_id
// dipakai namanya sendiri; kategori anak digabung ke nama induknya;
// transaksi tanpa kategori -> "Tanpa Kategori"). Query account_group
// JOIN ke accounts (account_id), query parent_category JOIN ke
// categories + self-join ke induknya (category_id). GROUP BY pakai id
// (bukan nama) supaya 2 grup/kategori beda id tapi nama kebetulan sama
// tidak tergabung keliru. Query label TIDAK join ke tabel junction
// (dipakai scalar subquery) supaya transaksi multi-label tidak
// menggandakan baris -- lihat PRIMARY_EFFECTIVE_LABEL_SUBQUERY soal
// kenapa cuma 1 label per transaksi yang dihitung di sini.
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
  label: `
    SELECT
      ${PRIMARY_LABEL} as group_key,
      COALESCE(${PRIMARY_LABEL}, 'Tanpa Label') as label,
      SUM(t.amount) as total
    FROM transactions t
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
