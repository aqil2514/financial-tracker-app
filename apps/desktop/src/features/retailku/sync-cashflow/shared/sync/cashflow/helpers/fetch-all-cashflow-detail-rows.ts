import { getCashflowDetail, type connectRetailkuMcp } from "@/shared/retailku";
import type { SyncCashflowInput } from "../types";

export async function fetchAllCashflowDetailRows(
  client: Awaited<ReturnType<typeof connectRetailkuMcp>>,
  input: Pick<SyncCashflowInput, "dateFrom" | "dateTo" | "timezone">
) {
  const rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"] = [];
  let page = 1;
  const limit = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await getCashflowDetail(client, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      timezone: input.timezone,
      page,
      limit,
    });
    rows.push(...result.data);
    if (page >= result.meta.pagination.totalPages) break;
    page += 1;
  }
  return rows;
}
