import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuInvestmentList, RetailkuInvestmentListRaw } from "../../types/tools/get_investment_list";
import { callToolAsJson } from "./call-tool-as-json";
import { isWithinWibDayRange } from "./wib-date-range";

export async function getInvestmentList(
  client: Client,
  args: { dateFrom: string; dateTo: string; timezone?: string; status?: "PENDING" | "POSTED" | "CANCELLED"; page?: number; limit?: number }
): Promise<RetailkuInvestmentList> {
  const raw = await callToolAsJson<RetailkuInvestmentListRaw>(client, "get_investment_list", { ...args, type: "BUY" });

  const data = raw.data
    .filter((item) => item.type === "BUY")
    .map((item) => ({
      id: item.id,
      number: item.number,
      type: item.type,
      status: item.status,
      date: item.date,
      amount: Number(item.amount),
      capitalAmount: item.capitalAmount != null ? Number(item.capitalAmount) : null,
      gainLoss: item.gainLoss != null ? Number(item.gainLoss) : null,
      notes: item.notes,
      cashAccount: item.cashAccount,
      investmentAccount: item.investmentAccount,
    }))
    .filter((item) => isWithinWibDayRange(item.date, args.dateFrom, args.dateTo));

  return {
    data,
    total: data.length,
    page: raw.page,
    limit: raw.limit,
  };
}
