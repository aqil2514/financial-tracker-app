"use client";

import { useQuery } from "@tanstack/react-query";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { buildOrderClause } from "@/components/query/sort/builders/sql";
import type { SortConfig } from "@/components/query/sort";
import { getDb } from "@/lib/db";

// Base key statis dipakai untuk invalidation (lib/query-dependencies.ts
// prefix-match ini terhadap SEMUA variant filter/sort di bawahnya) —
// JANGAN diubah jadi function, lihat queryKey aktual di dalam hook.
export const thirdPartyFundsQueryKey = ["third-party", "funds"];

// Diprefix `third_party_funds.` eksplisit (bukan nama kolom polos) karena
// query ini LEFT JOIN ke `transactions`, yang JUGA punya kolom `date` dan
// `amount` -- tanpa prefix, SQLite melempar "ambiguous column name" begitu
// filter/sort dipakai. Pemanggil (list.tsx FILTER_CONFIG/SORT_CONFIG) WAJIB
// memakai key yang SAMA PERSIS (sudah-prefixed) ini.
const FILTERABLE_COLUMNS = ["third_party_funds.direction", "third_party_funds.account_id"] as const;
// `direction` cuma 2 nilai ("in"/"out") -- bisa difilter, tapi urutan
// Titip/Ambil kurang bermakna utk sort, jadi tidak masuk daftar ini.
const SORTABLE_COLUMNS = ["third_party_funds.date", "third_party_funds.amount"] as const;

export type ThirdPartyFundRow = {
  id: string;
  account_id: string;
  account_name: string;
  contact_id: string;
  contact_name: string;
  transaction_id: string | null;
  /** Tipe transaksi jejak (`transactions.type`) — `income`/`expense`
   * berarti baris direct (titip/ambil langsung, 1 baris per transaksi),
   * `transfer` berarti bagian dari "Pindah Tempat/Kepemilikan" (2 baris
   * berpasangan per transaksi). `null` kalau `transaction_id` null
   * (seharusnya tidak pernah terjadi untuk baris third_party_funds yang
   * dibuat lewat jalur form, tapi tetap dijaga di tipe). Dipakai
   * `ThirdPartyFundList` utk menentukan baris mana yang dapat tombol Edit
   * (HANYA direct, lihat docs/todos/plan/account-type-third-party.md). */
  transaction_type: "income" | "expense" | "transfer" | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  note: string | null;
};

/** Riwayat titip/ambil lintas SEMUA akun `third_party` — tab "Data" (lihat
 * docs/todos/plan/account-type-third-party.md, Tab Data Read). Filter
 * (arah, akun) & sort (tanggal, jumlah) dibangun lewat builder generik yang
 * sama dgn Transaksi (`buildWhereClause`/`buildOrderClause`) — volume data
 * third_party tetap kecil, tapi sudah cukup banyak utk butuh filter/sort,
 * jadi dipakai builder yang sudah ada alih-alih menulis loop manual baru. */
export function useThirdPartyFunds(filters: FilterConfig[] = [], sorts: SortConfig[] = []) {
  return useQuery({
    queryKey: [...thirdPartyFundsQueryKey, filters, sorts],
    queryFn: async (): Promise<ThirdPartyFundRow[]> => {
      const db = await getDb();
      const { whereClause, params } = buildWhereClause(filters, FILTERABLE_COLUMNS, [
        { condition: "third_party_funds.deleted_at IS NULL" },
      ]);
      const orderClause = buildOrderClause(
        sorts,
        SORTABLE_COLUMNS,
        "third_party_funds.date DESC, third_party_funds.created_at DESC"
      );

      return db.select<ThirdPartyFundRow[]>(
        `SELECT
           third_party_funds.id,
           third_party_funds.account_id,
           accounts.name AS account_name,
           third_party_funds.contact_id,
           contacts.name AS contact_name,
           third_party_funds.transaction_id,
           transactions.type AS transaction_type,
           third_party_funds.direction,
           third_party_funds.amount,
           third_party_funds.date,
           third_party_funds.note
         FROM third_party_funds
         JOIN accounts ON accounts.id = third_party_funds.account_id
         JOIN contacts ON contacts.id = third_party_funds.contact_id
         LEFT JOIN transactions ON transactions.id = third_party_funds.transaction_id
         ${whereClause}
         ${orderClause}`,
        params
      );
    },
  });
}
