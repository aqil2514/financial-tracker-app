import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushForexAccountPayload = {
  accountId: string;
  country: string;
  currency: string;
  currentRate: number;
  updatedAt?: string;
};

export function pushForexAccount(creds: CloudSyncCredentials, payload: PushForexAccountPayload) {
  return pushUpsert(creds, "/forex/accounts/push", payload);
}
