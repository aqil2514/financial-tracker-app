import type { SQLiteDatabase } from "expo-sqlite";

// Sisa titipan per (account_id, contact_id) = SUM(in) - SUM(out). Tidak disimpan sebagai kolom — satu-satunya
// tempat rumus ini (pola sama getRemainingUnit di investasi). excludeFundId dipakai saat edit supaya baris
// yang sedang diedit tidak ikut terhitung dua kali.
export async function getRemainingThirdPartyFund(
  db: SQLiteDatabase,
  accountId: string,
  contactId: string,
  excludeFundId?: string
): Promise<number> {
  const row = await db.getFirstAsync<{ remaining: number }>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS remaining
     FROM third_party_funds
     WHERE account_id = ? AND contact_id = ? AND id != ?`,
    [accountId, contactId, excludeFundId ?? ""]
  );
  return row?.remaining ?? 0;
}
