import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { RetailkuSaleDetail, RetailkuSaleDetailRaw } from "../../types/tools/get_sale_detail";
import { callToolAsJson } from "./call-tool-as-json";

export async function getSaleDetail(client: Client, id: string): Promise<RetailkuSaleDetail> {
  const raw = await callToolAsJson<RetailkuSaleDetailRaw>(client, "get_sale_detail", { id });

  return {
    id: raw.id,
    number: raw.number,
    status: raw.status,
    transactionDate: raw.transactionDate,
    notes: raw.notes,
    discountAmount: Number(raw.discountAmount),
    discountPct: Number(raw.discountPct),
    totalAmount: Number(raw.totalAmount),
    totalCogs: Number(raw.totalCogs),
    totalPaid: Number(raw.totalPaid),
    outstandingAmount: Number(raw.outstandingAmount),
    createdAt: raw.createdAt,
    cancelledAt: raw.cancelledAt,
    items: raw.items.map((item) => ({
      ...item,
      basePrice: Number(item.basePrice),
      unitPrice: Number(item.unitPrice),
      unitCost: Number(item.unitCost),
      totalPrice: Number(item.totalPrice),
      totalCost: Number(item.totalCost),
    })),
    paymentLines: raw.paymentLines.map((line) => ({
      ...line,
      amount: Number(line.amount),
      feeAmount: Number(line.feeAmount),
    })),
    journalEntry: raw.journalEntry,
    customer: raw.customer,
    saleReturns: raw.saleReturns.map((saleReturn) => ({
      ...saleReturn,
      totalAmount: Number(saleReturn.totalAmount),
      refundLines: saleReturn.refundLines.map((line) => ({
        ...line,
        amount: Number(line.amount),
      })),
    })),
    salePayments: raw.salePayments.map((payment) => ({
      ...payment,
      totalAmount: Number(payment.totalAmount),
      items: payment.items.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
    })),
    createdBy: raw.createdBy,
  };
}
