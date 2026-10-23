import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuPurchaseOrderList, RetailkuPurchaseOrderListRaw } from "../../types/tools/get_purchase_order_list";
import { callToolAsJson } from "./call-tool-as-json";
import { isWithinWibDayRange } from "./wib-date-range";

export async function getPurchaseOrderList(
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
): Promise<RetailkuPurchaseOrderList> {
  const raw = await callToolAsJson<RetailkuPurchaseOrderListRaw>(client, "get_purchase_order_list", args);

  const data = raw.data
    .map((item) => ({
      id: item.id,
      number: item.number,
      status: item.status,
      orderDate: item.orderDate,
      totalAmount: Number(item.totalAmount),
      outstandingAmount: Number(item.outstandingAmount),
      notes: item.notes,
      supplier: item.supplier,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      items: item.items,
    }))
    .filter((item) => isWithinWibDayRange(item.orderDate, args.dateFrom, args.dateTo));

  return {
    data,
    meta: { ...raw.meta, pagination: { ...raw.meta.pagination, total: data.length } },
  };
}
