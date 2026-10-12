import { isAlive } from "../../shared";
import type { SyncSnapshot } from "../../types";

export function getRemainingUnit(snapshot: SyncSnapshot, accountId: string): number {
  let settledPurchased = 0;
  for (const p of snapshot.investmentPurchases) {
    if (!isAlive(p) || p.accountId !== accountId || p.status !== "settled") continue;
    settledPurchased += p.unit ?? 0;
  }
  let sold = 0;
  for (const s of snapshot.investmentSales) {
    if (!isAlive(s) || s.accountId !== accountId) continue;
    if (s.status !== "pending" && s.status !== "settled") continue;
    sold += s.unit;
  }
  return settledPurchased - sold;
}
