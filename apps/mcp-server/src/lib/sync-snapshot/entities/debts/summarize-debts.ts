import { isAlive } from "../../shared";
import type { SyncSnapshot } from "../../types";

export function summarizeDebts(snapshot: SyncSnapshot): {
  receivable: { ongoing: number; count: number };
  payable: { ongoing: number; count: number };
} {
  const summary = {
    receivable: { ongoing: 0, count: 0 },
    payable: { ongoing: 0, count: 0 },
  };

  const paidByDebt = new Map<string, number>();
  for (const p of snapshot.debtPayments) {
    if (!isAlive(p)) continue;
    paidByDebt.set(p.debtId, (paidByDebt.get(p.debtId) ?? 0) + p.amount);
  }

  for (const d of snapshot.debts) {
    if (!isAlive(d) || d.status !== "ongoing") continue;
    const paid = paidByDebt.get(d.id) ?? 0;
    const remaining = d.amount - paid;
    const bucket = d.type === "receivable" ? summary.receivable : summary.payable;
    bucket.ongoing += remaining;
    bucket.count += 1;
  }

  return summary;
}
