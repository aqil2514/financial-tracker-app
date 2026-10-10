import type { CloudSyncCredentials } from "../worker-client";
import { BACKFILL_ORDER } from "./backfill-order";
import { getAllIds } from "./get-all-ids";
import { getCategoryIdsParentsFirst } from "./get-category-ids-parents-first";
import { pushTable } from "./push-table";
import type { BackfillProgress, BackfillSummary } from "./types";

export type { BackfillProgress, BackfillSummary } from "./types";

export async function backfillSync(
  creds: CloudSyncCredentials,
  onProgress?: (progress: BackfillProgress) => void
): Promise<BackfillSummary> {
  const summary: BackfillSummary = { pushed: 0, rejected: 0, failed: 0 };

  for (const table of BACKFILL_ORDER) {
    const ids = table === "categories" ? await getCategoryIdsParentsFirst() : await getAllIds(table);
    await pushTable(creds, table, ids, summary, onProgress);
  }

  return summary;
}
