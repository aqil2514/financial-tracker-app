import type { LabelEntityScope } from "../worker-client";
import { detachLabelCloud } from "../worker-client";
import { resolveCredentials } from "./resolve-credentials";

export async function detachLabelOnWrite(scope: LabelEntityScope, entityId: string, labelId: string): Promise<void> {
  const creds = await resolveCredentials();
  if (!creds) return;
  try {
    await detachLabelCloud(creds, scope, entityId, labelId);
  } catch {
    // best-effort, lihat README.md
  }
}
