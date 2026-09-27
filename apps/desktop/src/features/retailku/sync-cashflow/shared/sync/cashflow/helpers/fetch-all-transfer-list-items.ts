import { getFundTransferList, type connectRetailkuMcp } from "@/shared/retailku";

/** Loop pagination `get_fund_transfer_list` sampai semua halaman
 * terambil — pola sama `fetch-all-cashflow-detail-rows.ts`, TAPI
 * kondisi berhenti beda (`{ total, page, limit }` langsung di
 * top-level, BUKAN `meta.pagination.totalPages`, lihat
 * `get-fund-transfer-list.ts`). Hanya `status: "POSTED"` yang diminta
 * ke server (transfer DRAFT/CANCELLED tidak relevan utk mapping/sync). */
export async function fetchAllTransferListItems(
  client: Awaited<ReturnType<typeof connectRetailkuMcp>>,
  input: { dateFrom: string; dateTo: string; timezone: string }
) {
  const items: Awaited<ReturnType<typeof getFundTransferList>>["data"] = [];
  let page = 1;
  const limit = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await getFundTransferList(client, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      timezone: input.timezone,
      status: "POSTED",
      page,
      limit,
    });
    items.push(...result.data);
    if (page * result.limit >= result.total) break;
    page += 1;
  }
  return items;
}
