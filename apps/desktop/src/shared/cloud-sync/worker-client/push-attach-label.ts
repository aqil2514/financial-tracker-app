import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";
import type { LabelEntityScope } from "./label-entity-scope";

export type PushAttachLabelPayload = {
  id: string;
  labelId: string;
  updatedAt?: string;
};

export function pushAttachLabel(
  creds: CloudSyncCredentials,
  scope: LabelEntityScope,
  entityId: string,
  payload: PushAttachLabelPayload
) {
  return pushUpsert(creds, `/labels/${scope}/${encodeURIComponent(entityId)}`, payload);
}
