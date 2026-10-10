import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushInvestmentPurchasePayload = {
  id: string;
  accountId: string;
  transactionId: string;
  unit: number | null;
  pricePerUnit: number | null;
  date: string;
  status?: "pending" | "settled";
  updatedAt?: string;
};

export function pushInvestmentPurchase(creds: CloudSyncCredentials, payload: PushInvestmentPurchasePayload) {
  return pushUpsert(creds, "/investments/purchases/push", payload);
}
