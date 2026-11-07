import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushForexSalePayload = {
  id: string;
  accountId: string;
  transactionId: string;
  adjustmentTransactionId: string | null;
  unit: number;
  rate: number;
  averageCostPerUnit: number;
  realizedPl: number;
  date: string;
  updatedAt?: string;
};

export function pushForexSale(creds: CloudSyncCredentials, payload: PushForexSalePayload) {
  return pushUpsert(creds, "/forex/sales/push", payload);
}
