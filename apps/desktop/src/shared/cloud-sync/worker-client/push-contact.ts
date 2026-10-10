import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushContactPayload = { id: string; name: string; note?: string | null; updatedAt?: string };

export function pushContact(creds: CloudSyncCredentials, payload: PushContactPayload) {
  return pushUpsert(creds, "/contacts", payload);
}
