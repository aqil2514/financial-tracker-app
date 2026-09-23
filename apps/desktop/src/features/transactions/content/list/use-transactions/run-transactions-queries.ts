import { getDb } from "@/lib/db";
import { HAS_ATTACHMENT_SUBQUERY, type TransactionListRow } from "./interface";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * `running_balance` (saldo akun ini SETELAH transaksi tsb terjadi) cuma
 * dihitung kalau query di-scope ke satu akun (`accountId` diberikan) —
 * tidak bermakna untuk list transaksi campur semua akun (halaman
 * Transaksi biasa). Dihitung lewat CTE `SUM() OVER (ORDER BY date ASC,
 * id ASC)` terhadap SEMUA transaksi tabel `transactions` (window function
 * TIDAK BOLEH di-filter dulu ke akun ini di dalam CTE — `whereClause` dari
 * pemanggil SUDAH mengandung `(account_id = $N OR transfer_account_id =
 * $N)` untuk akun ini, jadi diterapkan APA ADANYA di luar CTE, sama
 * seperti filter/sort/pagination lain, supaya SATU whereClause yang sama
 * berlaku baik untuk query baris maupun query count — trade-off yang
 * diterima: predicate akun itu jadi terlihat "redundant" dibanding pola
 * PARTITION BY, tapi tidak salah, dan menghindari perlu whereClause kedua
 * yang terpisah cuma untuk kasus ini).
 *
 * Filter/sort/pagination dari pemanggil (`whereClause`/`orderClause`/
 * `limitOffsetClause`) diterapkan DI LUAR CTE — supaya baris manapun
 * yang lolos filter user (note/type/tanggal/dst) tetap punya
 * `running_balance` yang dihitung dari BASIS LENGKAP transaksi akun ini
 * (bukan basis yang sudah kena filter user), sama seperti pola
 * `features/accounts/dialogs/detail-dialog/right-side/running-balance-query.ts`
 * (dipakai modal "Lihat Detail" akun, sumber rumus tanda +income/-expense/
 * -transfer keluar/+transfer masuk yang di-duplikasi di sini — SENGAJA
 * tidak di-share karena kolom SELECT-nya beda, list ini butuh
 * `has_attachment` juga).
 *
 * `accountId` numbered placeholder ($N) ditaruh di URUTAN PALING AKHIR
 * (`allParams.length + 1`, setelah whereClause DAN limitOffset) — SQLite
 * numbered placeholder di-resolve berdasarkan ANGKANYA (bukan posisi
 * tekstual di SQL), jadi aman dipakai berulang (tiga kali di CTE) walau
 * ditulis di awal string SQL.
 */
export const runTransactionsQueries = (
  db: Db,
  clauses: {
    whereClause: string;
    params: unknown[];
    orderClause: string;
    limitOffsetClause: string;
    limitOffsetParams: unknown[];
    accountId?: number;
  }
) => {
  const rowsParams = [...clauses.params, ...clauses.limitOffsetParams];

  if (clauses.accountId == null) {
    return Promise.all([
      db.select<TransactionListRow[]>(
        `SELECT transactions.*, ${HAS_ATTACHMENT_SUBQUERY} as has_attachment
         FROM transactions ${clauses.whereClause} ${clauses.orderClause} ${clauses.limitOffsetClause}`,
        rowsParams
      ),
      db.select<{ total: number }[]>(
        `SELECT COUNT(*) as total FROM transactions ${clauses.whereClause}`,
        clauses.params
      ),
    ]);
  }

  const accountIdIndex = rowsParams.length + 1;

  return Promise.all([
    db.select<TransactionListRow[]>(
      `WITH ordered_tx AS (
         SELECT
           transactions.*,
           ${HAS_ATTACHMENT_SUBQUERY} as has_attachment,
           (
             (SELECT initial_balance FROM accounts WHERE id = $${accountIdIndex})
             + SUM(
                 CASE
                   WHEN type = 'income' THEN amount
                   WHEN type = 'expense' THEN -amount
                   WHEN type = 'transfer' AND account_id = $${accountIdIndex} THEN -amount
                   WHEN type = 'transfer' AND transfer_account_id = $${accountIdIndex} THEN amount
                   ELSE 0
                 END
               ) OVER (ORDER BY date ASC, id ASC)
           ) AS running_balance
         FROM transactions
         WHERE account_id = $${accountIdIndex} OR transfer_account_id = $${accountIdIndex}
       )
       SELECT * FROM ordered_tx ${clauses.whereClause} ${clauses.orderClause} ${clauses.limitOffsetClause}`,
      [...rowsParams, clauses.accountId]
    ),
    db.select<{ total: number }[]>(
      `WITH ordered_tx AS (
         SELECT transactions.*
         FROM transactions
         WHERE account_id = $${clauses.params.length + 1} OR transfer_account_id = $${clauses.params.length + 1}
       )
       SELECT COUNT(*) as total FROM ordered_tx ${clauses.whereClause}`,
      [...clauses.params, clauses.accountId]
    ),
  ]);
};
