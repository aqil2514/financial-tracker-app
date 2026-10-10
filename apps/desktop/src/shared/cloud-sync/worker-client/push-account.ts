import type { AccountType } from "@/lib/account-types";
import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushAccountPayload = {
  id: string;
  name: string;
  initialBalance: number;
  groupId?: string | null;
  description?: string | null;
  isActive?: boolean;
  accountType: AccountType;
  icon?: string | null;
  color?: string | null;
  updatedAt?: string;
};

export function pushAccount(creds: CloudSyncCredentials, payload: PushAccountPayload) {
  return pushUpsert(creds, "/accounts", payload);
}
