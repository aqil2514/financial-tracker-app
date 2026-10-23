import { formatCurrency } from "@/lib/format-currency";
import { getPurchaseOrderDetail } from "../helpers/tools/get_purchase_order_detail";
import { getPurchaseOrderList } from "../helpers/tools/get_purchase_order_list";
import type { RetailkuPurchaseOrderDetail } from "../types/tools/get_purchase_order_detail";
import type { DetailAdapter } from "../types";
import type { RetailkuPackageEntry, RetailkuToolEntry } from "./types";

function toLocalDateTimeInputValue(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const purchaseOrderAdapter: DetailAdapter<RetailkuPurchaseOrderDetail> = (raw) => ({
  amount: formatCurrency(raw.totalAmount, "IDR"),
  note: raw.notes || undefined,
  fields: [
    { label: "Nomor PO", value: raw.number },
    { label: "Status", value: raw.status },
    { label: "Tanggal Order", value: new Date(raw.orderDate).toLocaleDateString("id-ID") },
    { label: "Supplier", value: raw.supplier?.name ?? "-" },
    { label: "Total", value: formatCurrency(raw.totalAmount, "IDR") },
    { label: "Sudah Dibayar", value: formatCurrency(raw.totalPaid + raw.totalDownPayment, "IDR") },
    { label: "Sisa Tagihan", value: formatCurrency(raw.outstandingAmount, "IDR") },
    ...raw.items.map((item) => ({
      label: itemLabel(item),
      value: `${item.quantity} ${item.purchaseUnitName} — ${formatCurrency(item.totalPrice, "IDR")}`,
    })),
  ],
});

function itemLabel(item: RetailkuPurchaseOrderDetail["items"][number]) {
  return item.product?.name ?? item.material?.name ?? item.itemName ?? "Item";
}

function toPurchaseOrderPackage(raw: RetailkuPurchaseOrderDetail): RetailkuPackageEntry[] {
  const date = toLocalDateTimeInputValue(raw.orderDate);
  const { note, description } = toPurchaseOrderNoteAndDescription(raw.items, raw.totalAmount);

  return raw.purchasePayments.flatMap((payment) =>
    payment.lines.map((line) => ({
      id: `payment-${payment.id}-${line.id}`,
      label: `Pembayaran ${payment.number} — ${line.account.name}`,
      target: "transaction" as const,
      defaultValues: {
        type: "expense" as const,
        amount: line.amount,
        account_id: line.account.id,
        contact_name: raw.supplier?.name ?? null,
        note,
        description,
        date,
      },
    }))
  );
}

function itemDescriptionLine(item: RetailkuPurchaseOrderDetail["items"][number]) {
  const unitPrice = formatCurrency(item.unitPrice, "IDR");
  const subtotal = formatCurrency(item.unitPrice * item.quantity, "IDR");
  return `${itemLabel(item)} x ${item.quantity} ${item.purchaseUnitName} x ${unitPrice} = ${subtotal}`;
}

function toPurchaseOrderNoteAndDescription(items: RetailkuPurchaseOrderDetail["items"], totalAmount: number) {
  const note =
    items.length <= 2
      ? items.map((item) => `${itemLabel(item)} ${item.quantity} ${item.purchaseUnitName}`).join(" & ")
      : "Pembelian";

  const description = {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: items.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: itemDescriptionLine(item) }] }],
        })),
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: `Total Belanja: ${formatCurrency(totalAmount, "IDR")}` }],
      },
    ],
  };

  return { note, description };
}

export const getPurchaseOrderEntry: RetailkuToolEntry = {
  label: "Purchase Order",
  fetchList: async (client, range) => {
    const result = await getPurchaseOrderList(client, range);
    return result.data.map((item) => ({
      id: item.id,
      label: `${item.number} — ${new Date(item.orderDate).toLocaleDateString("id-ID")}`,
      description: formatCurrency(item.totalAmount, "IDR"),
      raw: item,
    }));
  },
  fetchDetail: (client, id) => getPurchaseOrderDetail(client, id),
  adapter: purchaseOrderAdapter as DetailAdapter,
  toPackage: (detail) => toPurchaseOrderPackage(detail as RetailkuPurchaseOrderDetail),
};
