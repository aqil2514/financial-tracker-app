import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushInvestmentAccountPayload = {
  accountId: string;
  unitLabel: string;
  currentMarketValue: number;
  updatedAt?: string;
};

export function pushInvestmentAccount(creds: CloudSyncCredentials, payload: PushInvestmentAccountPayload) {
  return pushUpsert(creds, "/investments/accounts/push", payload);
}
