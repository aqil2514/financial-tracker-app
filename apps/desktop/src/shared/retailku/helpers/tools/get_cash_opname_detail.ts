import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuCashOpnameDetail, RetailkuCashOpnameDetailRaw } from "../../types/tools/get_cash_opname_detail";
import { callToolAsJson } from "./call-tool-as-json";

export async function getCashOpnameDetail(client: Client, id: string): Promise<RetailkuCashOpnameDetail> {
  const raw = await callToolAsJson<RetailkuCashOpnameDetailRaw>(client, "get_cash_opname_detail", { id });

  return {
    id: raw.id,
    status: raw.status,
    countedAt: raw.countedAt,
    systemBalance: Number(raw.systemBalance),
    thirdPartyFunds: raw.thirdPartyFunds,
    physicalTotal: Number(raw.physicalTotal),
    netTotal: Number(raw.netTotal),
    difference: Number(raw.difference),
    notes: raw.notes,
    account: raw.account,
    journalEntryId: raw.journalEntryId,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    postedBy: raw.postedBy,
    postedAt: raw.postedAt,
    items: raw.items.map((item) => ({
      id: item.id,
      denominationId: item.denominationId,
      label: item.label,
      value: item.value,
      quantity: item.quantity,
      subtotal: Number(item.subtotal),
    })),
  };
}
