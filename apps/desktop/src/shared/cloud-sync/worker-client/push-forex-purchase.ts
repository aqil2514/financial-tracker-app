import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushForexPurchasePayload = {
  id: string;
  accountId: string;
  transactionId: string;
  unit: number;
  rate: number;
  date: string;
  updatedAt?: string;
};

export function pushForexPurchase(creds: CloudSyncCredentials, payload: PushForexPurchasePayload) {
  return pushUpsert(creds, "/forex/purchases/push", payload);
}
