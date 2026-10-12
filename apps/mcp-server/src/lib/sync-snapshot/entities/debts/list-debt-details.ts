import { isAlive } from "../../shared";
import type { Debt, DebtPayment, SyncSnapshot } from "../../types";

export function listDebtDetails(
  snapshot: SyncSnapshot,
  options: { debtId?: string; contactId?: string } = {}
): Array<Debt & { remaining: number; payments: DebtPayment[] }> {
  return snapshot.debts
    .filter((d) => isAlive(d))
    .filter((d) => !options.debtId || d.id === options.debtId)
    .filter((d) => !options.contactId || d.contactId === options.contactId)
    .map((d) => {
      const payments = snapshot.debtPayments.filter((p) => isAlive(p) && p.debtId === d.id);
      const paid = payments.reduce((sum, p) => sum + p.amount, 0);
      return { ...d, remaining: d.amount - paid, payments };
    });
}
