import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushCategoryPeriodPayload = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  categoryIds: Array<{ id: string; categoryId: string }>;
  updatedAt?: string;
};

export function pushCategoryPeriod(creds: CloudSyncCredentials, payload: PushCategoryPeriodPayload) {
  return pushUpsert(creds, "/category-periods/push", payload);
}
