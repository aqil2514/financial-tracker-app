import { isAlive } from "../../shared";
import type { Debt, DebtPayment, SyncSnapshot, Transaction } from "../../types";
import { listDebtDetails } from "./list-debt-details";

export function listContactHistory(
  snapshot: SyncSnapshot,
  contactId: string
): { transactions: Transaction[]; debts: Array<Debt & { remaining: number; payments: DebtPayment[] }> } {
  return {
    transactions: snapshot.transactions.filter((t) => isAlive(t) && t.contactId === contactId),
    debts: listDebtDetails(snapshot, { contactId }),
  };
}
