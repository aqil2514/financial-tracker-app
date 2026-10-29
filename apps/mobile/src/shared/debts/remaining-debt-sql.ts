// Satu-satunya definisi SQL untuk `remaining` (sisa piutang/utang) —
// wajib di-reuse di semua query (list, FIFO, validasi), jangan
// diduplikasi manual. Mobile tidak punya deleted_at di debt_payments
// (lihat docs/todos/plan/porting-account-debt.md), jadi fragment ini
// lebih sederhana dari versi desktop (apps/desktop/src/shared/debts/
// remaining-debt-sql.ts) yang masih harus filter soft-delete.
//
// excludeTransactionIdParam: placeholder SQL ("?") untuk transaction_id
// yang pembayarannya SENGAJA diabaikan dari perhitungan — dipakai saat
// edit transaksi berperan role: 'payment' (pembayarannya belum
// di-recreate saat form baru dibuka, lihat use-transaction-debt-fields.ts).
// Kalau dipakai, placeholder-nya WAJIB disisipkan di posisi yang benar
// pada array params pemanggil query (lihat pemakaiannya).
export function remainingDebtSql(options?: {
  amountExpr?: string;
  debtIdExpr?: string;
  excludeTransactionIdParam?: string;
}): string {
  const amountExpr = options?.amountExpr ?? "debts.amount";
  const debtIdExpr = options?.debtIdExpr ?? "debts.id";
  const excludeCondition = options?.excludeTransactionIdParam
    ? ` AND (${options.excludeTransactionIdParam} IS NULL OR debt_payments.transaction_id IS NOT ${options.excludeTransactionIdParam})`
    : "";
  return `(${amountExpr} - COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = ${debtIdExpr}${excludeCondition}), 0))`;
}
