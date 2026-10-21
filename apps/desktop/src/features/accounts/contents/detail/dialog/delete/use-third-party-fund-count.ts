"use client";

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

/** Jumlah baris `third_party_funds` (riwayat titip/ambil, lunas atau
 * belum — SEMUA baris, bukan cuma yang sisa titipannya != 0) milik satu
 * akun `third_party` — dipakai `DeleteAccountDialog` untuk melarang hapus
 * akun yang masih punya riwayat sama sekali (lihat docs/todos/plan/account-type-third-party.md,
 * "Tab Akun — Delete": FK `third_party_funds.account_id` ON DELETE
 * CASCADE akan diam-diam menghapus/mengorbankan riwayat dengan cara yang
 * tidak konsisten kalau akun dihapus langsung, baik lewat "unassign"
 * maupun "reassign" — jadi dicegah di titik ini SEBELUM delete terjadi,
 * bukan dibersihkan sesudahnya). Hanya relevan untuk `account_type ===
 * 'third_party'` — caller yang menjamin ini, `enabled` di bawah
 * men-skip query untuk tipe akun lain. */
export function useThirdPartyFundCount(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["accounts", "third-party-fund-count", accountId],
    enabled,
    queryFn: async () => {
      const db = await getDb();
      const [{ count }] = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM third_party_funds WHERE account_id = $1",
        [accountId]
      );
      return count;
    },
  });
}
