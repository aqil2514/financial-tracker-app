import { isAlive } from "../../shared";
import type { SyncSnapshot } from "../../types";
import { getInvestmentHolding } from "./get-investment-holding";

export function summarizeInvestments(snapshot: SyncSnapshot): {
  accounts: Array<{
    accountId: string;
    accountName: string;
    unitLabel: string;
    balance: number;
    marketValue: number;
    unrealizedPl: number;
    unrealizedPlPercent: number;
    totalUnit: number;
    averageCost: number | null;
    remainingUnit: number;
  }>;
  totalUnrealizedPl: number;
  totalRealizedPl: number;
};
export function summarizeInvestments(snapshot: SyncSnapshot) {
  const accountById = new Map(snapshot.accounts.map((a) => [a.id, a]));

  const accounts = snapshot.investmentAccounts
    .filter((a) => isAlive(a))
    .map((a) => {
      const holding = getInvestmentHolding(snapshot, a.accountId);
      const account = accountById.get(a.accountId);
      return {
        accountId: a.accountId,
        accountName: account?.name ?? "Tidak diketahui",
        unitLabel: a.unitLabel,
        balance: holding?.balance ?? 0,
        marketValue: holding?.marketValue ?? a.currentMarketValue,
        unrealizedPl: holding?.unrealizedPl ?? 0,
        unrealizedPlPercent: holding?.unrealizedPlPercent ?? 0,
        totalUnit: holding?.totalUnit ?? 0,
        averageCost: holding?.averageCost ?? null,
        remainingUnit: holding?.remainingUnit ?? 0,
      };
    });

  const totalUnrealizedPl = accounts.reduce((sum, a) => sum + a.unrealizedPl, 0);
  const totalRealizedPl = snapshot.investmentSales
    .filter((s) => isAlive(s) && s.status === "settled")
    .reduce((sum, s) => sum + (s.realizedPl ?? 0), 0);

  return { accounts, totalUnrealizedPl, totalRealizedPl };
}
