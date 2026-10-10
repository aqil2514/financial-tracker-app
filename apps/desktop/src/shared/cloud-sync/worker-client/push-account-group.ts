import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushAccountGroupPayload = { id: string; name: string; updatedAt?: string };

export function pushAccountGroup(creds: CloudSyncCredentials, payload: PushAccountGroupPayload) {
  return pushUpsert(creds, "/account-groups", payload);
}
