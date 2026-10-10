import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushInvestmentSalePayload = {
  id: string;
  accountId: string;
  transactionId: string | null;
  adjustmentTransactionId: string | null;
  unit: number;
  pricePerUnit: number;
  averageCostPerUnit: number | null;
  realizedPl: number | null;
  date: string;
  status?: "pending" | "settled";
  updatedAt?: string;
};

export function pushInvestmentSale(creds: CloudSyncCredentials, payload: PushInvestmentSalePayload) {
  return pushUpsert(creds, "/investments/sales/push", payload);
}
