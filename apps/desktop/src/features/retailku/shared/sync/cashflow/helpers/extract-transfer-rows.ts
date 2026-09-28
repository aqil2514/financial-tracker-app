import type { getFundTransferList } from "@/shared/retailku/mcp-tools";

/** Satu baris transfer dana MENTAH dari `get_fund_transfer_list` —
 * BUKAN diagregasi per hari/akun seperti `aggregate-by-*.ts` (baris
 * kas biasa) — `fromAccountId`/`toAccountId` SUDAH eksplisit dari
 * sumbernya sendiri (2 akun, TIDAK ambigu arah net kas seperti
 * `sourceType` lain), jadi TIDAK lewat `computeCashflowSync`/
 * `aggregate-by-*.ts` sama sekali (lihat
 * docs/todos/plan/retailku-dynamic-sourcetype-mapping.md).
 *
 * `key` mengikuti ATURAN PENULISAN KEY yang sudah dipakai jalur generic
 * (lihat docs/todos/plan/retailku-sync-field-mapping.md, "Bentuk key"):
 * identitas JENIS pergerakan (UUID akun Retailku), BUKAN identitas
 * transaksi individual — `transfer:<fromAccountId>:<toAccountId>`,
 * SEPASANG akun yang SAMA (mis. semua "Kas Tunai -> Seabank") berbagi
 * SATU mapping, TIDAK perlu diulang tiap transfer baru. SEMPAT SALAH
 * ditulis pakai `number` dokumen (`transfer:TRF-260926-01`) di iterasi
 * pertama — DIKOREKSI user 2026-09-28: itu bikin key baru per transaksi,
 * kontradiksi total dgn tujuan mapping ("atur sekali, berlaku
 * selamanya"). `sourceRef` (BEDA dari `key`) TETAP per transaksi —
 * tujuannya idempotency insert, bukan identitas mapping. */
export type TransferRow = {
  key: string;
  transferId: string;
  transferNumber: string;
  date: string;
  fromAccountId: string;
  fromAccountCode: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountCode: string;
  toAccountName: string;
  amount: number;
  sourceRef: string;
};

/** Ubah hasil mentah `get_fund_transfer_list` (SUDAH di-fetch pemanggil,
 * lihat pola sama `extractArApRows` — fungsi ini TIDAK memanggil MCP
 * sendiri) jadi `TransferRow[]` siap dipakai jalur mapping/plan. Hanya
 * status `POSTED` yang diproses — `DRAFT`/`CANCELLED` belum final
 * secara akuntansi, TIDAK relevan untuk sync. */
export function extractTransferRows(
  items: Awaited<ReturnType<typeof getFundTransferList>>["data"]
): TransferRow[] {
  return items
    .filter((item) => item.status === "POSTED")
    .map((item) => ({
      key: `transfer:${item.fromAccount.id}:${item.toAccount.id}`,
      transferId: item.id,
      transferNumber: item.number,
      date: item.transactionDate.slice(0, 10),
      fromAccountId: item.fromAccount.id,
      fromAccountCode: item.fromAccount.code,
      fromAccountName: item.fromAccount.name,
      toAccountId: item.toAccount.id,
      toAccountCode: item.toAccount.code,
      toAccountName: item.toAccount.name,
      amount: item.transferAmount,
      sourceRef: `${item.id}:transfer`,
    }));
}
