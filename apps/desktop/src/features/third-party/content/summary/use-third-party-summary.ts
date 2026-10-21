"use client";

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export const thirdPartySummaryQueryKey = ["third-party", "summary"];

export type ThirdPartySummaryRow = {
  account_id: string;
  account_name: string;
  contact_id: string;
  contact_name: string;
  remaining: number;
};

/** Breakdown "siapa titip berapa, di mana" per (akun, kontak) — tab
 * "Ringkasan" (lihat docs/concept/konsep-dana-pihak-ketiga.md, "Fitur
 * turunan"). Sisa dihitung ulang dari SUM(in) - SUM(out), BUKAN kolom
 * tersimpan (konsisten dgn getRemainingThirdPartyFund di
 * shared/third-party-funds/). `HAVING remaining != 0` -- pasangan
 * akun+kontak yang sudah lunas (net 0) tidak perlu ditampilkan di
 * ringkasan, sama seperti debt yang sudah 'paid' tidak muncul di ongoing. */
export function useThirdPartySummary() {
  return useQuery({
    queryKey: thirdPartySummaryQueryKey,
    queryFn: async (): Promise<ThirdPartySummaryRow[]> => {
      const db = await getDb();
      return db.select<ThirdPartySummaryRow[]>(
        `SELECT
           accounts.id AS account_id,
           accounts.name AS account_name,
           contacts.id AS contact_id,
           contacts.name AS contact_name,
           SUM(CASE WHEN third_party_funds.direction = 'in' THEN third_party_funds.amount ELSE -third_party_funds.amount END) AS remaining
         FROM third_party_funds
         JOIN accounts ON accounts.id = third_party_funds.account_id
         JOIN contacts ON contacts.id = third_party_funds.contact_id
         WHERE third_party_funds.deleted_at IS NULL
         GROUP BY accounts.id, contacts.id
         HAVING remaining != 0
         ORDER BY contacts.name COLLATE NOCASE, accounts.name COLLATE NOCASE`
      );
    },
  });
}
