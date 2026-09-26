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
  direction: "receivable" | "payable";
  /** Piutang baru = akun piutang DEBIT (net positif), pelunasan = akun
   * piutang KREDIT (net negatif) — arahnya BERLAWANAN untuk utang
   * (`payable`): utang baru = KREDIT, pelunasan = DEBIT. Sudah
   * dinormalisasi di sini (positif = "baru", negatif = "pelunasan")
   * supaya konsumen tidak perlu tahu normalBalance akun lagi. */
  amount: number;
  sourceRef: string;
};

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
        direction,
        amount,
        sourceRef: `${row.id}:ar_ap`,
      };
    });
}
