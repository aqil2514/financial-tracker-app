import { getFundTransferList, type connectRetailkuMcp } from "@/shared/retailku";

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
