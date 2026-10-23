import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuDirectPurchaseDetail, RetailkuDirectPurchaseDetailRaw } from "../../types/tools/get_direct_purchase_detail";
import { callToolAsJson } from "./call-tool-as-json";

export async function getDirectPurchaseDetail(client: Client, id: string): Promise<RetailkuDirectPurchaseDetail> {
  const raw = await callToolAsJson<RetailkuDirectPurchaseDetailRaw>(client, "get_direct_purchase_detail", { id });

  return {
    id: raw.id,
    number: raw.number,
    status: raw.status,
    purchaseDate: raw.purchaseDate,
    notes: raw.notes,
    subtotalAmount: Number(raw.subtotalAmount),
    itemDiscountAmount: Number(raw.itemDiscountAmount),
    adjustmentAmount: Number(raw.adjustmentAmount),
    totalAmount: Number(raw.totalAmount),
    totalPaid: Number(raw.totalPaid),
    outstandingAmount: Number(raw.outstandingAmount),
    createdAt: raw.createdAt,
    supplier: raw.supplier,
    items: raw.items.map((item) => ({
      ...item,
      conversionToBase: Number(item.conversionToBase),
      baseQuantity: Number(item.baseQuantity),
      unitPrice: Number(item.unitPrice),
      discountValue: item.discountValue == null ? null : Number(item.discountValue),
      discountAmount: Number(item.discountAmount),
      subtotal: Number(item.subtotal),
      netTotal: Number(item.netTotal),
      costAdjustmentAllocation: Number(item.costAdjustmentAllocation),
      inventoryCostAmount: Number(item.inventoryCostAmount),
    })),
    adjustments: raw.adjustments.map((adjustment) => ({
      ...adjustment,
      amount: Number(adjustment.amount),
    })),
    paymentLines: raw.paymentLines.map((line) => ({
      ...line,
      amount: Number(line.amount),
    })),
    journalEntry: raw.journalEntry,
    createdBy: raw.createdBy,
  };
}
