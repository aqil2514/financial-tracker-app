import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuDirectPurchaseList, RetailkuDirectPurchaseListRaw } from "../../types/tools/get_direct_purchase_list";
import { callToolAsJson } from "./call-tool-as-json";
import { isWithinWibDayRange } from "./wib-date-range";

export async function getDirectPurchaseList(
  client: Client,
  args: {
    dateFrom: string;
    dateTo: string;
    timezone?: string;
    number?: string;
    status?: string;
    supplierId?: string;
    page?: number;
    limit?: number;
  }
): Promise<RetailkuDirectPurchaseList> {
  const raw = await callToolAsJson<RetailkuDirectPurchaseListRaw>(client, "get_direct_purchase_list", args);

  const data = raw.data
    .map((item) => ({
      id: item.id,
      number: item.number,
      status: item.status,
      purchaseDate: item.purchaseDate,
      totalAmount: Number(item.totalAmount),
      totalPaid: Number(item.totalPaid),
      outstandingAmount: Number(item.outstandingAmount),
      createdAt: item.createdAt,
      supplier: item.supplier,
      createdBy: item.createdBy,
    }))
    .filter((item) => isWithinWibDayRange(item.purchaseDate, args.dateFrom, args.dateTo));

  return {
    data,
    meta: { ...raw.meta, pagination: { ...raw.meta.pagination, total: data.length } },
  };
}
