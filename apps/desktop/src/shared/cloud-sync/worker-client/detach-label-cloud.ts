import { request } from "./request";
import type { CloudSyncCredentials } from "./types";
import type { LabelEntityScope } from "./label-entity-scope";

export async function detachLabelCloud(
  creds: CloudSyncCredentials,
  scope: LabelEntityScope,
  entityId: string,
  labelId: string
): Promise<void> {
  await request(creds, `/labels/${scope}/${encodeURIComponent(entityId)}/${encodeURIComponent(labelId)}`, {
    method: "DELETE",
  });
}
