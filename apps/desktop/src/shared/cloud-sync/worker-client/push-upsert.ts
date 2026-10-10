import { request } from "./request";
import type { CloudSyncCredentials } from "./types";
import { WorkerRequestError } from "./worker-request-error";
import type { PushUpsertResult } from "./push-upsert-result";

export async function pushUpsert(
  creds: CloudSyncCredentials,
  path: string,
  payload: Record<string, unknown>
): Promise<PushUpsertResult> {
  try {
    const result = await request<{ status: "ok" | "ignored" }>(creds, path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (result.status === "ignored") return { status: "ignored" };
    return { status: "ok" };
  } catch (err) {
    if (err instanceof WorkerRequestError && err.status === 422) {
      return { status: "rejected", reason: err.message };
    }
    throw err;
  }
}
