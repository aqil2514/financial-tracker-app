import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushCategoryPayload = {
  id: string;
  name: string;
  type: "income" | "expense";
  icon?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  updatedAt?: string;
};

export function pushCategory(creds: CloudSyncCredentials, payload: PushCategoryPayload) {
  return pushUpsert(creds, "/categories", payload);
}
