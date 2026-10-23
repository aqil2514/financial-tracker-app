import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuSaleList, RetailkuSaleListRaw } from "../../types/tools/get_sale_list";
import { callToolAsJson } from "./call-tool-as-json";

export async function getSaleList(
  client: Client,
  args: {
    dateFrom: string;
    dateTo: string;
    timezone?: string;
    customerName?: string;
    number?: string;
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<RetailkuSaleList> {
  const raw = await callToolAsJson<RetailkuSaleListRaw>(client, "get_sale_list", args);

  return {
    data: raw.data.map((item) => ({
      id: item.id,
      number: item.number,
      status: item.status,
      transactionDate: item.transactionDate,
      totalAmount: Number(item.totalAmount),
      totalCogs: Number(item.totalCogs),
      outstandingAmount: Number(item.outstandingAmount),
      customer: item.customer,
      items: item.items,
      saleReturns: item.saleReturns,
      createdBy: item.createdBy,
    })),
    meta: raw.meta,
  };
}
