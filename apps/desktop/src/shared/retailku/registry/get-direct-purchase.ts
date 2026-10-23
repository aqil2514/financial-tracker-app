import { formatCurrency } from "@/lib/format-currency";
import { getDirectPurchaseDetail } from "../helpers/tools/get_direct_purchase_detail";
import { getDirectPurchaseList } from "../helpers/tools/get_direct_purchase_list";
import type { RetailkuDirectPurchaseDetail } from "../types/tools/get_direct_purchase_detail";
import type { DetailAdapter } from "../types";
import type { RetailkuPackageEntry, RetailkuToolEntry } from "./types";

function toLocalDateTimeInputValue(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const directPurchaseAdapter: DetailAdapter<RetailkuDirectPurchaseDetail> = (raw) => ({
  amount: formatCurrency(raw.totalAmount, "IDR"),
  note: raw.notes || undefined,
  fields: [
    { label: "Nomor DPB", value: raw.number },
    { label: "Status", value: raw.status },
    { label: "Tanggal Beli", value: new Date(raw.purchaseDate).toLocaleDateString("id-ID") },
    { label: "Supplier", value: raw.supplier?.name ?? "-" },
    { label: "Total", value: formatCurrency(raw.totalAmount, "IDR") },
    { label: "Sudah Dibayar", value: formatCurrency(raw.totalPaid, "IDR") },
    { label: "Sisa Tagihan", value: formatCurrency(raw.outstandingAmount, "IDR") },
    ...raw.items.map((item) => ({
      label: itemLabel(item),
      value: `${item.quantity} ${item.purchaseUnitName} — ${formatCurrency(item.netTotal, "IDR")}`,
    })),
  ],
});

function itemLabel(item: RetailkuDirectPurchaseDetail["items"][number]) {
  return item.product?.name ?? item.material?.name ?? item.itemName ?? "Item";
}

function toDirectPurchasePackage(raw: RetailkuDirectPurchaseDetail): RetailkuPackageEntry[] {
  const date = toLocalDateTimeInputValue(raw.purchaseDate);
  const { note, description } = toDirectPurchaseNoteAndDescription(raw.items, raw.totalAmount);

  return raw.paymentLines.map((line) => ({
    id: `payment-${line.id}`,
    label: `Pembayaran — ${line.account.name}`,
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
  }));
}

function itemDescriptionLine(item: RetailkuDirectPurchaseDetail["items"][number]) {
  const unitPrice = formatCurrency(item.unitPrice, "IDR");
  const subtotal = formatCurrency(item.unitPrice * item.quantity, "IDR");
  return `${itemLabel(item)} x ${item.quantity} ${item.purchaseUnitName} x ${unitPrice} = ${subtotal}`;
}

function toDirectPurchaseNoteAndDescription(items: RetailkuDirectPurchaseDetail["items"], totalAmount: number) {
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

export const getDirectPurchaseEntry: RetailkuToolEntry = {
  label: "Pembelian Langsung",
  fetchList: async (client, range) => {
    const result = await getDirectPurchaseList(client, range);
    return result.data.map((item) => ({
      id: item.id,
      label: `${item.number} — ${new Date(item.purchaseDate).toLocaleDateString("id-ID")}`,
      description: formatCurrency(item.totalAmount, "IDR"),
      raw: item,
    }));
  },
  fetchDetail: (client, id) => getDirectPurchaseDetail(client, id),
  adapter: directPurchaseAdapter as DetailAdapter,
  toPackage: (detail) => toDirectPurchasePackage(detail as RetailkuDirectPurchaseDetail),
};
