import { isAlive } from "../../shared";
import type { ThirdPartyFund, SyncSnapshot } from "../../types";

// Riwayat baris titip/ambil/pindah, pola PERSIS listDebtDetails --
// difilter per akun dan/atau kontak (kedua filter opsional, AND kalau
// keduanya diisi). TIDAK menghitung `remaining` di sini (beda dari
// listDebtDetails yang menghitung per-baris) -- third_party_funds sisa-nya
// SELALU per (accountId, contactId), bukan per baris individual, lihat
// summarizeThirdParty.
export function listThirdPartyDetail(
  snapshot: SyncSnapshot,
  options: { accountId?: string; contactId?: string } = {}
): ThirdPartyFund[] {
  return snapshot.thirdPartyFunds
    .filter((f) => isAlive(f))
    .filter((f) => !options.accountId || f.accountId === options.accountId)
    .filter((f) => !options.contactId || f.contactId === options.contactId)
    .sort((a, b) => a.date.localeCompare(b.date));
}
