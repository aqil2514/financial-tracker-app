import { isAlive } from "../../shared";
import type { InvestmentPurchase, InvestmentSale, SyncSnapshot } from "../../types";

export function listInvestmentDetail(
  snapshot: SyncSnapshot,
  accountId: string
): {
  purchases: InvestmentPurchase[];
  sales: InvestmentSale[];
} {
  return {
    purchases: snapshot.investmentPurchases.filter((p) => isAlive(p) && p.accountId === accountId),
    sales: snapshot.investmentSales.filter((s) => isAlive(s) && s.accountId === accountId),
  };
}
