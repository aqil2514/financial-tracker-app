import type { CloudSyncCredentials } from "../worker-client";
import { pushRowPayload } from "../push-row";
import type { QueueableTable } from "../push-queue";
import { logRejectedPush, clearRejectedLog } from "../rejected-log";
import type { BackfillProgress, BackfillSummary } from "./types";

export async function pushTable(
  creds: CloudSyncCredentials,
  table: QueueableTable,
  ids: string[],
  summary: BackfillSummary,
  onProgress?: (progress: BackfillProgress) => void
): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    try {
      const result = await pushRowPayload(creds, table, ids[i]);
      if (result?.status === "rejected") {
        summary.rejected++;
        await logRejectedPush(table, ids[i], result.reason);
      } else {
        summary.pushed++;
        await clearRejectedLog(table, ids[i]);
      }
    } catch {
      summary.failed++;
    }
    onProgress?.({ table, done: i + 1, total: ids.length });
  }
}
