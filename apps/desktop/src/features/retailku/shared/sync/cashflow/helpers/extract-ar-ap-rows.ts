import type { getCashflowDetail } from "@/shared/retailku";

/** Satu baris piutang/utang MENTAH dari `get_cashflow_detail`
 * (`isReceivablePayableAccount: true`) — BUKAN diagregasi per hari
 * seperti `aggregate-by-*.ts` (baris kas biasa), karena identitas
 * idempotency-nya adalah `id` JURNAL ITEM individual (unik selamanya
 * dari Retailku), bukan tanggal+akun. Lihat
 * docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md. */
export type ArApRow = {
  journalItemId: string;
  date: string;
  /** Akun jurnal piutang/utang Retailku ("Piutang Dagang"/"Hutang ke
   * Penitip") — dasar `key` mapping (lihat di bawah), SAMA pola dgn key
   * generic (`detail:<accountId>:...`). Data nyata (Warung Aqil,
   * 2026-09): cuma 1-2 akun total per toko, jadi mapping AR/AP HANYA
   * 1-2 baris (bukan per pihak). */
  accountId: string;
  accountCode: string;
  accountName: string;
  direction: "receivable" | "payable";
  /** Identitas PIHAK Retailku (customer/supplier) baris ini — BUKAN
   * bagian `key` (lihat di bawah), dipakai HANYA sbg sumber toggle
   * "Mengikuti Retailku" (kontak per transaksi), SAMA konsep
   * `noteFollowSource` di varian lain. `null` kalau sisi Retailku belum
   * bisa resolve pihaknya — toggle tetap bisa ON, TAPI transaksi baris
   * ini akan fallback ke kontak statis mapping (tidak ada partyName
   * utk diikuti). */
  partyId: string | null;
  partyName: string | null;
  /** Piutang baru = akun piutang DEBIT (net positif), pelunasan = akun
   * piutang KREDIT (net negatif) — arahnya BERLAWANAN untuk utang
   * (`payable`): utang baru = KREDIT, pelunasan = DEBIT. Sudah
   * dinormalisasi di sini (positif = "baru", negatif = "pelunasan")
   * supaya konsumen tidak perlu tahu normalBalance akun lagi. */
  amount: number;
  sourceRef: string;
};

/** `key` mapping AR/AP — PER AKUN JURNAL Retailku ("Piutang Dagang"/
 * "Hutang ke Penitip") + arah, SAMA pola persis dgn key generic
 * (`detail:<accountId>:<sourceType>:<arah>`) — BUKAN per pihak (dicoba
 * 2026-09-28, DIBATALKAN: pihak berpindah metode bayar bebas kapan saja
 * — mis. hari ini Kas Tunai besok Transfer Bank utk pihak yang SAMA —
 * beda sifat dari pasangan akun transfer yang memang STABIL selamanya,
 * jadi tidak cocok jadi identitas key). Identitas pihak (`partyName`)
 * tetap dipakai TAPI cuma sbg sumber toggle "Mengikuti Retailku" (lihat
 * `ArApRow.partyId`), bukan pemisah key. */
export function buildArApMappingKey(accountId: string, direction: "receivable" | "payable"): string {
  return `ar_ap:${accountId}:${direction}`;
}

/** Pisahkan baris `isReceivablePayableAccount: true` dari hasil mentah
 * `get_cashflow_detail` — DIPANGGIL SEBELUM `aggregate-by-*.ts` (yang
 * TIDAK boleh ikut menghitung baris ini sebagai net kas akun biasa,
 * lihat catatan `isReceivablePayableAccount` di get-cashflow-detail.ts).
 * `sourceRef` per baris pakai `journalItemId` MENTAH (bukan tanggal+akun
 * seperti cashflow biasa) — journal item Retailku unik SELAMANYA, jadi
 * idempotency-nya persis 1:1 tanpa perlu agregasi/prefix apa pun. */
export function extractArApRows(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): ArApRow[] {
  return rows
    .filter((row) => row.isReceivablePayableAccount && row.receivablePayableDirection != null)
    .map((row) => {
      const direction = row.receivablePayableDirection as "receivable" | "payable";
      // receivable: debit = piutang baru (+), credit = pelunasan (-).
      // payable: credit = utang baru (+), debit = pelunasan (-) —
      // berlawanan dari receivable karena normalBalance akun beda
      // (ASSET vs LIABILITY), dinormalisasi di sini jadi satu aturan
      // tanda yang sama utk konsumen: positif SELALU "baru", negatif
      // SELALU "pelunasan".
      const amount = direction === "receivable" ? row.debit - row.credit : row.credit - row.debit;
      return {
        journalItemId: row.id,
        date: row.date.slice(0, 10),
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        partyId: row.partyId,
        partyName: row.partyName,
        direction,
        amount,
        sourceRef: `${row.id}:ar_ap`,
      };
    });
}
