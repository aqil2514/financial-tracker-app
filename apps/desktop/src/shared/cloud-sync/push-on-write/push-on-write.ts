import type { QueueableTable } from "../push-queue";
import { enqueueUpsertPush } from "../push-queue";
import { pushRowPayload } from "../push-row";
import { resolveCredentials } from "./resolve-credentials";

export async function pushOnWrite(table: QueueableTable, id: string): Promise<void> {
  const creds = await resolveCredentials();
  if (!creds) return;

  try {
    const result = await pushRowPayload(creds, table, id);
    if (!result || result.status === "rejected") return;
  } catch {
    await enqueueUpsertPush(table, id);
  }
}
