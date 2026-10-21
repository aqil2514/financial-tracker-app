"use client";

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export const thirdPartyFundsQueryKey = ["third-party", "funds"];

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
 * docs/todos/plan/account-type-third-party.md, Tab Data Read). Sengaja
 * TIDAK pakai filter/sort builder generik (beda dari use-contact-summary.ts)
 * — konsisten dgn keputusan ThirdPartyAccountList (tab Akun) bahwa volume
 * data third_party biasanya kecil, query sederhana sudah cukup. */
export function useThirdPartyFunds() {
  return useQuery({
    queryKey: thirdPartyFundsQueryKey,
    queryFn: async (): Promise<ThirdPartyFundRow[]> => {
      const db = await getDb();
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
         WHERE third_party_funds.deleted_at IS NULL
         ORDER BY third_party_funds.date DESC, third_party_funds.created_at DESC`
      );
    },
  });
}
