import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import type { AccountType } from "@/lib/account-types";

export type Granularity = "day" | "week" | "month" | "year";

export type BalanceTrendPoint = {
  label: string;
  balance: number;
};

export const balanceTrendQueryKey = ["reports", "balance-trend"];

export type BalanceTrendFilter = {
  accountTypes: AccountType[];
  groupIds: string[];
  accountIds: string[];
};

// Format strftime SQLite per granularitas — dipakai utk GROUP BY titik
// waktu. "week" pakai %Y-%W (minggu ke-N dalam tahun) karena SQLite
// tidak punya format ISO-week bawaan yang lebih akurat.
const STRFTIME_FORMAT: Record<Granularity, string> = {
  day: "%Y-%m-%d",
  week: "%Y-%W",
  month: "%Y-%m",
  year: "%Y",
};

// Filter akun (tipe/grup/akun individual) SEMUA opsional & independen
// (AND) — lihat "Tren Keuangan — filter level akun" di plan doc.
// Dibangun sebagai kondisi tambahan terhadap tabel accounts `a`,
// params di-push urut supaya posisi placeholder $N selalu sinkron.
//
// Akun nonaktif: di-exclude SECARA DEFAULT (saat `accountIds` kosong,
// user tidak memilih akun spesifik) — tapi kalau user SENGAJA memilih
// akun individual (termasuk yang nonaktif, ditandai "(Nonaktif)" di
// dropdown), filter is_active dilepas supaya pilihan eksplisit itu
// tetap ikut terhitung.
function buildAccountFilter(filter: BalanceTrendFilter, params: unknown[]): string {
  const conditions: string[] = [];

  if (filter.accountIds.length === 0) {
    conditions.push("a.is_active = 1");
  }

  if (filter.accountTypes.length > 0) {
    const placeholders = filter.accountTypes.map((type) => {
      params.push(type);
      return `$${params.length}`;
    });
    conditions.push(`a.account_type IN (${placeholders.join(", ")})`);
  }

  if (filter.groupIds.length > 0) {
    const placeholders = filter.groupIds.map((id) => {
      params.push(id);
      return `$${params.length}`;
    });
    conditions.push(`a.group_id IN (${placeholders.join(", ")})`);
  }

  if (filter.accountIds.length > 0) {
    const placeholders = filter.accountIds.map((id) => {
      params.push(id);
      return `$${params.length}`;
    });
    conditions.push(`a.id IN (${placeholders.join(", ")})`);
  }

  return conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
}

// Builder di atas sekarang SUDAH termasuk kondisi is_active (lihat
// catatan di atasnya) — pemanggil tidak perlu lagi tambah `WHERE
// a.is_active = 1` terpisah, cukup `WHERE 1=1 ${accountFilter}`.

export function useBalanceTrend(
  from: string,
  to: string,
  granularity: Granularity,
  filter: BalanceTrendFilter
) {
  return useQuery({
    queryKey: [...balanceTrendQueryKey, from, to, granularity, filter],
    queryFn: async () => {
      const db = await getDb();
      const strftimeFormat = STRFTIME_FORMAT[granularity];

      // 1. Saldo awal: total initial_balance + seluruh transaksi akun
      //    terfilter SEBELUM tanggal `from`.
      const openingParams: unknown[] = [from];
      const openingAccountFilter = buildAccountFilter(filter, openingParams);
      const [openingRow] = await db.select<{ balance: number }[]>(
        `SELECT COALESCE(SUM(
           a.initial_balance
             + COALESCE((SELECT SUM(CASE
                 WHEN t.type = 'income' THEN t.amount
                 WHEN t.type = 'expense' THEN -t.amount
                 WHEN t.type = 'transfer' THEN -t.amount
                 ELSE 0
               END) FROM transactions t WHERE t.account_id = a.id AND date(t.date) < $1), 0)
             + COALESCE((SELECT SUM(t.amount) FROM transactions t
                 WHERE t.type = 'transfer' AND t.transfer_account_id = a.id AND date(t.date) < $1), 0)
         ), 0) as balance
         FROM accounts a
         WHERE 1=1 ${openingAccountFilter}`,
        openingParams
      );
      const openingBalance = openingRow?.balance ?? 0;

      // 2. Net perubahan per titik waktu (granularitas), dalam rentang
      //    from..to, utk akun yang sama. Dua SELECT (transaksi langsung
      //    di akun + transfer masuk dari akun lain) di-UNION ALL lalu
      //    di-GROUP BY ulang per titik — running sum dihitung di JS,
      //    BUKAN re-SUM per titik dari awal waktu (lihat "Catatan
      //    performa" di plan doc). Params dibangun sekali di urutan
      //    SELECT 1 lalu SELECT 2, placeholder $N dari masing-masing
      //    builder otomatis sinkron karena satu array `params` dipakai
      //    bersambung (builder ke-2 melanjutkan dari panjang array
      //    setelah builder ke-1 selesai push).
      const params: unknown[] = [from, to];
      const accountFilter1 = buildAccountFilter(filter, params);
      const fromPlaceholder2 = `$${params.length + 1}`;
      const toPlaceholder2 = `$${params.length + 2}`;
      params.push(from, to);
      const accountFilter2 = buildAccountFilter(filter, params);

      const rows = await db.select<{ point: string; net: number }[]>(
        `SELECT point, SUM(net) as net FROM (
           SELECT strftime('${strftimeFormat}', t.date) as point,
             CASE
               WHEN t.type = 'income' THEN t.amount
               WHEN t.type = 'expense' THEN -t.amount
               WHEN t.type = 'transfer' THEN -t.amount
               ELSE 0
             END as net
           FROM transactions t
           JOIN accounts a ON a.id = t.account_id
           WHERE date(t.date) BETWEEN $1 AND $2 ${accountFilter1}

           UNION ALL

           SELECT strftime('${strftimeFormat}', t.date) as point, t.amount as net
           FROM transactions t
           JOIN accounts a ON a.id = t.transfer_account_id
           WHERE t.type = 'transfer'
             AND date(t.date) BETWEEN ${fromPlaceholder2} AND ${toPlaceholder2} ${accountFilter2}
         )
         GROUP BY point
         ORDER BY point ASC`,
        params
      );

      let running = openingBalance;
      return rows.map((row) => {
        running += row.net;
        return { label: row.point, balance: running };
      }) satisfies BalanceTrendPoint[];
    },
  });
}
