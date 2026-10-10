import type { DeletableTable } from "../push-queue";
import { enqueueDeletePush } from "../push-queue";
import type { DeleteCloudPayload } from "../worker-client";
import { deleteCloudRow } from "../worker-client";
import { resolveCredentials } from "./resolve-credentials";

export async function pushDeleteOnWrite(
  table: DeletableTable,
  id: string,
  payload: Omit<Extract<DeleteCloudPayload, { table: typeof table }>, "table">
): Promise<void> {
  const creds = await resolveCredentials();
  if (!creds) return;

  try {
    await deleteCloudRow(creds, table, id, payload);
  } catch {
    await enqueueDeletePush(table, id, payload);
  }
}
