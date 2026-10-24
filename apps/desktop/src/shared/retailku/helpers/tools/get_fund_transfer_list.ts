import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuFundTransferList, RetailkuFundTransferListRaw } from "../../types/tools/get_fund_transfer_list";
import { callToolAsJson } from "./call-tool-as-json";
import { isWithinWibDayRange } from "./wib-date-range";

export async function getFundTransferList(
  client: Client,
  args: { dateFrom: string; dateTo: string; timezone?: string; status?: "DRAFT" | "POSTED" | "CANCELLED"; page?: number; limit?: number }
): Promise<RetailkuFundTransferList> {
  const raw = await callToolAsJson<RetailkuFundTransferListRaw>(client, "get_fund_transfer_list", args);

  const data = raw.data
    .map((item) => ({
      id: item.id,
      number: item.number,
      transactionDate: item.transactionDate,
      description: item.description,
      transferAmount: Number(item.transferAmount),
      fromFee: Number(item.fromFee),
      toFee: Number(item.toFee),
      status: item.status,
      fromAccount: item.fromAccount,
      toAccount: item.toAccount,
    }))
    .filter((item) => isWithinWibDayRange(item.transactionDate, args.dateFrom, args.dateTo));

  return {
    data,
    total: data.length,
    page: raw.page,
    limit: raw.limit,
  };
}
