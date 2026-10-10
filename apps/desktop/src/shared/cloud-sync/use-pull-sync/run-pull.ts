import type { QueryClient } from "@tanstack/react-query";

import { applySyncResponse } from "../pull-sync";
import { pullAttachments } from "../pull-attachments";
import { retryPendingPushes } from "../push-on-write";
import { pullSync, type CloudSyncCredentials } from "../worker-client";

export async function runPull(
  creds: CloudSyncCredentials,
  lastCheckpoint: string | null,
  lastAttachmentsCheckpoint: string | null,
  attachmentFolder: string | null,
  setCheckpoint: (checkpoint: string) => Promise<unknown>,
  setAttachmentsCheckpoint: (checkpoint: string) => Promise<unknown>,
  queryClient: QueryClient
): Promise<void> {
  await retryPendingPushes();

  const response = await pullSync(creds, lastCheckpoint);
  await applySyncResponse(response);
  await setCheckpoint(response.checkpoint);

  const attachmentsCheckpoint = await pullAttachments(creds, lastAttachmentsCheckpoint, attachmentFolder);
  await setAttachmentsCheckpoint(attachmentsCheckpoint);

  await queryClient.invalidateQueries();
}
