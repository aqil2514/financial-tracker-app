import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuCashOpnameList, RetailkuCashOpnameListRaw } from "../../types/tools/get_cash_opname_list";
import { callToolAsJson } from "./call-tool-as-json";
import { isWithinWibDayRange } from "./wib-date-range";

export async function getCashOpnameList(
  client: Client,
  args: { dateFrom: string; dateTo: string; timezone?: string; page?: number; limit?: number }
): Promise<RetailkuCashOpnameList> {
  const raw = await callToolAsJson<RetailkuCashOpnameListRaw>(client, "get_cash_opname_list", args);

  const data = raw.data
    .map((item) => ({
      id: item.id,
      status: item.status,
      countedAt: item.countedAt,
      systemBalance: Number(item.systemBalance),
      physicalTotal: Number(item.physicalTotal),
      netTotal: Number(item.netTotal),
      difference: Number(item.difference),
      createdBy: item.createdBy,
      createdAt: item.createdAt,
    }))
    .filter((item) => isWithinWibDayRange(item.countedAt, args.dateFrom, args.dateTo));

  return {
    data,
    total: data.length,
    page: raw.page,
    limit: raw.limit,
  };
}
