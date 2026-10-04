/**
 * Satu-satunya definisi SQL untuk `remaining` (sisa piutang/utang) —
 * `amount - SUM(debt_payments.amount belum dihapus)`. Sebelum file ini
 * ada, ekspresi ini ditulis ulang manual di 5 tempat berbeda
 * (use-ongoing-debts.ts, use-debts-list.ts, use-contact-debts.ts,
 * use-contact-summary.ts, apply-debt-transaction.ts) dan sudah DRIFT
 * nyata: subquery FIFO di apply-debt-transaction.ts lupa filter
 * `debt_payments.deleted_at IS NULL`, jadi payment yang sudah dihapus
 * masih ikut mengurangi `remaining` saat alokasi FIFO. Lihat
 * mcp-server-business-logic-audit.md untuk latar belakang lengkap.
 *
 * SQLite tidak punya VIEW yang dipakai di sini (query ditulis per hook,
 * bukan lewat ORM) — jadi "sumber kebenaran tunggal" diwujudkan sebagai
 * fragment SQL yang di-generate dari satu fungsi, bukan computed di JS
 * (supaya tetap bisa di-SORT/FILTER di level SQL seperti sebelumnya).
 */

/**
 * Fragment subquery utk `SUM(debt_payments.amount)` milik satu `debts.id`.
 * `debtIdExpr` adalah ekspresi SQL yang merujuk ke id debt-nya (biasa
 * `debts.id`), supaya bisa dipakai di subquery berlapis (mis.
 * use-contact-summary.ts yang sudah di dalam subquery lain).
 *
 * `excludeTransactionId` opsional: param SQL (mis. `$3`) yang isinya
 * transaction_id yang payment-nya SENGAJA diabaikan dari perhitungan —
 * dipakai use-ongoing-debts.ts untuk transaksi yang sedang diedit
 * (pembayarannya belum di-recreate saat form dibuka).
 */
export function sumDebtPaymentsSql(
  debtIdExpr: string,
  excludeTransactionIdParam?: string
): string {
  const excludeCondition = excludeTransactionIdParam
    ? ` AND (${excludeTransactionIdParam} IS NULL OR debt_payments.transaction_id IS NOT ${excludeTransactionIdParam})`
    : "";
  return `(SELECT SUM(amount) FROM debt_payments
            WHERE debt_payments.debt_id = ${debtIdExpr}
              AND debt_payments.deleted_at IS NULL${excludeCondition})`;
}

/**
 * Fragment `remaining` lengkap (`amount - COALESCE(sum pembayaran, 0)`)
 * utk satu baris `debts`. `amountExpr`/`debtIdExpr` default ke
 * `debts.amount`/`debts.id` (kasus paling umum: SELECT langsung dari
 * tabel `debts`) — override kalau dipanggil dari subquery berlapis
 * (mis. `use-contact-summary.ts`, alias beda).
 */
export function remainingDebtSql(options?: {
  amountExpr?: string;
  debtIdExpr?: string;
  excludeTransactionIdParam?: string;
}): string {
  const amountExpr = options?.amountExpr ?? "debts.amount";
  const debtIdExpr = options?.debtIdExpr ?? "debts.id";
  return `${amountExpr} - COALESCE(${sumDebtPaymentsSql(debtIdExpr, options?.excludeTransactionIdParam)}, 0)`;
}
