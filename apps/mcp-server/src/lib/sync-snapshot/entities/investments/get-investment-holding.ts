import { computeAccountBalance } from "../accounts/compute-account-balance";
import { isAlive } from "../../shared";
import type { SyncSnapshot } from "../../types";
import { getRemainingUnit } from "./get-remaining-unit";

export function getInvestmentHolding(
  snapshot: SyncSnapshot,
  accountId: string
): {
  balance: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPercent: number;
  totalUnit: number;
  averageCost: number | null;
  remainingUnit: number;
} | null {
  const investmentAccount = snapshot.investmentAccounts.find((a) => a.accountId === accountId && isAlive(a));
  if (!investmentAccount) return null;

  const balance = computeAccountBalance(snapshot, accountId) ?? 0;
  const marketValue = investmentAccount.currentMarketValue;
  const unrealizedPl = marketValue - balance;
  const unrealizedPlPercent = balance !== 0 ? (unrealizedPl / balance) * 100 : 0;

  let totalUnit = 0;
  for (const p of snapshot.investmentPurchases) {
    if (!isAlive(p) || p.accountId !== accountId) continue;
    totalUnit += p.unit ?? 0;
  }
  const averageCost = totalUnit !== 0 ? balance / totalUnit : null;

  return {
    balance,
    marketValue,
    unrealizedPl,
    unrealizedPlPercent,
    totalUnit,
    averageCost,
    remainingUnit: getRemainingUnit(snapshot, accountId),
  };
}
