import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";
import type { LabelScope } from "./label-scope";

export type PushLabelPayload = {
  id: string;
  name: string;
  scope: LabelScope;
  updatedAt?: string;
};

export function pushLabel(creds: CloudSyncCredentials, payload: PushLabelPayload) {
  return pushUpsert(creds, "/labels", payload);
}
