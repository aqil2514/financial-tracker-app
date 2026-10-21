import type { Db } from "./types";

/**
 * Sisa titipan per (account_id, contact_id) — `SUM(direction='in') -
 * SUM(direction='out')`, bukan kolom tersimpan (lihat
 * docs/concept/konsep-dana-pihak-ketiga.md "Keputusan final": tidak perlu
 * kolom `status`, sisa dihitung ulang tiap kali). Pola sama
 * `remaining-debt-sql.ts` / `getRemainingUnit` (investasi).
 */
export async function getRemainingThirdPartyFund(
  db: Db,
  accountId: string,
  contactId: string
): Promise<number> {
  const rows = await db.select<{ remaining: number }[]>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS remaining
     FROM third_party_funds
     WHERE account_id = $1 AND contact_id = $2`,
    [accountId, contactId]
  );
  return rows[0]?.remaining ?? 0;
}

/**
 * Sama seperti `getRemainingThirdPartyFund`, TAPI mengecualikan satu
 * baris tertentu dari perhitungan — dipakai saat EDIT baris yang sudah
 * ada (baris lama itu sendiri tidak boleh ikut dihitung sebagai "sisa
 * yang tersedia", kalau tidak validasi oversell akan salah menghitung
 * baris yang sedang diedit dua kali: sekali dari data lama di DB, sekali
 * dari nominal baru yang mau divalidasi). Lihat
 * use-edit-third-party-fund.ts.
 */
export async function getRemainingThirdPartyFundExcluding(
  db: Db,
  accountId: string,
  contactId: string,
  excludeId: string
): Promise<number> {
  const rows = await db.select<{ remaining: number }[]>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS remaining
     FROM third_party_funds
     WHERE account_id = $1 AND contact_id = $2 AND id != $3`,
    [accountId, contactId, excludeId]
  );
  return rows[0]?.remaining ?? 0;
}
