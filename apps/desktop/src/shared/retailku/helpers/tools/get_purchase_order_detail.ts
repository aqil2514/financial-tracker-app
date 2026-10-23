import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuPurchaseOrderDetail, RetailkuPurchaseOrderDetailRaw } from "../../types/tools/get_purchase_order_detail";
import { callToolAsJson } from "./call-tool-as-json";

export async function getPurchaseOrderDetail(client: Client, id: string): Promise<RetailkuPurchaseOrderDetail> {
  const raw = await callToolAsJson<RetailkuPurchaseOrderDetailRaw>(client, "get_purchase_order_detail", { id });

  return {
    id: raw.id,
    number: raw.number,
    status: raw.status,
    orderDate: raw.orderDate,
    subtotalAmount: Number(raw.subtotalAmount),
    itemDiscountAmount: Number(raw.itemDiscountAmount),
    adjustmentAmount: Number(raw.adjustmentAmount),
    totalAmount: Number(raw.totalAmount),
    totalPaid: Number(raw.totalPaid),
    totalDownPayment: Number(raw.totalDownPayment),
    outstandingAmount: Number(raw.outstandingAmount),
    notes: raw.notes,
    sentAt: raw.sentAt,
    cancelledAt: raw.cancelledAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    supplier: raw.supplier,
    adjustments: raw.adjustments.map((adjustment) => ({
      ...adjustment,
      amount: Number(adjustment.amount),
    })),
    items: raw.items.map((item) => ({
      ...item,
      conversionToBase: Number(item.conversionToBase),
      baseQuantity: Number(item.baseQuantity),
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
      discountValue: item.discountValue == null ? null : Number(item.discountValue),
      discountAmount: Number(item.discountAmount),
      netTotal: Number(item.netTotal),
      costAdjustmentAllocation: Number(item.costAdjustmentAllocation),
      totalPrice: Number(item.totalPrice),
    })),
    purchasePayments: raw.purchasePayments.map((payment) => ({
      ...payment,
      totalAmount: Number(payment.totalAmount),
      appliedDownPayment: Number(payment.appliedDownPayment),
      lines: payment.lines.map((line) => ({
        ...line,
        amount: Number(line.amount),
      })),
    })),
    createdBy: raw.createdBy,
  };
}
