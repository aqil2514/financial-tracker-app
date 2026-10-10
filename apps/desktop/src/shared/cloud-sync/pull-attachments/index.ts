import type { CloudSyncCredentials } from "../worker-client";
import { listAttachmentsSince } from "../worker-client";
import { deleteLocalAttachment } from "./delete-local-attachment";
import { downloadLocalAttachment } from "./download-local-attachment";
import { hasLocalRow } from "./has-local-row";
import { hasLocalTransaction } from "./has-local-transaction";

export async function pullAttachments(
  creds: CloudSyncCredentials,
  since: string | null,
  targetDir: string | null
): Promise<string> {
  const { checkpoint, attachments } = await listAttachmentsSince(creds, since);

  for (const item of attachments) {
    if (item.deletedAt !== null) {
      await deleteLocalAttachment(item.id);
      continue;
    }

    if (!(await hasLocalTransaction(item.transactionId))) continue;

    const alreadyLocal = await hasLocalRow("transaction_attachments", item.id);
    if (alreadyLocal) continue;

    await downloadLocalAttachment(creds, item, targetDir);
  }

  return checkpoint;
}
