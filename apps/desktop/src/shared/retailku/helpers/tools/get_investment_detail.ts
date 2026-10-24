import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuInvestmentDetail, RetailkuInvestmentDetailRaw } from "../../types/tools/get_investment_detail";
import { callToolAsJson } from "./call-tool-as-json";

export async function getInvestmentDetail(client: Client, id: string): Promise<RetailkuInvestmentDetail> {
  const raw = await callToolAsJson<RetailkuInvestmentDetailRaw>(client, "get_investment_detail", { id });

  return {
    id: raw.id,
    number: raw.number,
    type: raw.type,
    status: raw.status,
    date: raw.date,
    amount: Number(raw.amount),
    capitalAmount: raw.capitalAmount != null ? Number(raw.capitalAmount) : null,
    gainLoss: raw.gainLoss != null ? Number(raw.gainLoss) : null,
    notes: raw.notes,
    cashAccount: raw.cashAccount,
    investmentAccount: raw.investmentAccount,
  };
}
