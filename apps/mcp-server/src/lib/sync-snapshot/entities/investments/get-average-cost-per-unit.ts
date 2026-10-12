import { isAlive } from "../../shared";
import type { SyncSnapshot } from "../../types";

export function getAverageCostPerUnit(snapshot: SyncSnapshot, accountId: string): number {
  let totalCost = 0;
  let totalUnit = 0;
  for (const p of snapshot.investmentPurchases) {
    if (!isAlive(p) || p.accountId !== accountId || p.status !== "settled") continue;
    totalCost += (p.unit ?? 0) * (p.pricePerUnit ?? 0);
    totalUnit += p.unit ?? 0;
  }
  return totalUnit !== 0 ? totalCost / totalUnit : 0;
}
