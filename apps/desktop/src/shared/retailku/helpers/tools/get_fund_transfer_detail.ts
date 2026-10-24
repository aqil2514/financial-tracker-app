import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuFundTransferDetail, RetailkuFundTransferDetailRaw } from "../../types/tools/get_fund_transfer_detail";
import { callToolAsJson } from "./call-tool-as-json";

export async function getFundTransferDetail(client: Client, id: string): Promise<RetailkuFundTransferDetail> {
  const raw = await callToolAsJson<RetailkuFundTransferDetailRaw>(client, "get_fund_transfer_detail", { id });

  return {
    id: raw.id,
    transactionDate: raw.transactionDate,
    description: raw.description,
    transferAmount: Number(raw.transferAmount),
    fromFee: Number(raw.fromFee),
    toFee: Number(raw.toFee),
    status: raw.status,
    fromAccount: raw.fromAccount,
    toAccount: raw.toAccount,
  };
}
