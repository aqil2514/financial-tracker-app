import { enqueueDeletePush } from "../push-queue";
import type { TransactionDebtInfo } from "../worker-client";
import { deleteTransactionCloud } from "../worker-client";
import { resolveCredentials } from "./resolve-credentials";

export async function pushDeleteTransactionOnWrite(id: string): Promise<TransactionDebtInfo | null> {
  const creds = await resolveCredentials();
  if (!creds) return null;

  try {
    return await deleteTransactionCloud(creds, id);
  } catch {
    await enqueueDeletePush("transactions", id, {});
    return null;
  }
}
