// Satu-satunya definisi SQL untuk `remaining` (sisa piutang/utang) —
// wajib di-reuse di semua query (list, FIFO, validasi), jangan
// diduplikasi manual. Mobile tidak punya deleted_at di debt_payments
// (lihat docs/todos/plan/porting-account-debt.md), jadi fragment ini
// lebih sederhana dari versi desktop (apps/desktop/src/shared/debts/
// remaining-debt-sql.ts) yang masih harus filter soft-delete.
export function remainingDebtSql(options?: { amountExpr?: string; debtIdExpr?: string }): string {
  const amountExpr = options?.amountExpr ?? "debts.amount";
  const debtIdExpr = options?.debtIdExpr ?? "debts.id";
  return `(${amountExpr} - COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = ${debtIdExpr}), 0))`;
}
