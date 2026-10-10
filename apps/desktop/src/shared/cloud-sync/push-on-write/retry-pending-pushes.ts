import { flushPushQueue } from "../push-queue";
import { resolveCredentials } from "./resolve-credentials";

export async function retryPendingPushes(): Promise<void> {
  const creds = await resolveCredentials();
  if (!creds) return;
  await flushPushQueue(creds);
}
