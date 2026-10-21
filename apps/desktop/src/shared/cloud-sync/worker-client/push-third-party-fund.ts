import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushThirdPartyFundPayload = {
  id: string;
  accountId: string;
  contactId: string;
  transactionId: string | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  note?: string | null;
  updatedAt?: string;
};

export function pushThirdPartyFund(creds: CloudSyncCredentials, payload: PushThirdPartyFundPayload) {
  return pushUpsert(creds, "/third-party-funds/push", payload);
}
