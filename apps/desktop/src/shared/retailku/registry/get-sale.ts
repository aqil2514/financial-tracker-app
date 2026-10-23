import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { formatCurrency } from "@/lib/format-currency";
import { getSaleDetail } from "../helpers/tools/get_sale_detail";
import { getSaleList } from "../helpers/tools/get_sale_list";
import { isWithinWibDayRange } from "../helpers/tools/wib-date-range";
import type { RetailkuSaleDetail, RetailkuSaleDetailItem, RetailkuSaleProductType } from "../types/tools/get_sale_detail";
import type { RetailkuPackageEntry, RetailkuSummaryToolEntry, RetailkuToolDateRange } from "./types";

function toLocalDateTimeInputValue(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function fetchAllSales(client: Client, range: RetailkuToolDateRange): Promise<RetailkuSaleDetail[]> {
  const sales: RetailkuSaleDetail[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const list = await getSaleList(client, { ...range, timezone: "Asia/Jakarta", status: "POSTED", page, limit: 50 });
    totalPages = list.meta.pagination.totalPages;
    const details = await Promise.all(list.data.map((item) => getSaleDetail(client, item.id)));
    sales.push(...details);
    page += 1;
  } while (page <= totalPages);

  // `get_sale_list` Retailku TIDAK menghormati parameter `timezone` secara akurat di
  // batas hari (dikonfirmasi 2026-10-24: dateFrom=dateTo="2026-10-15" tetap mengembalikan
  // nota sampai "2026-10-16T11:28:36.691Z", lewat dari batas 15 Okt WIB, root cause
  // ditelusuri sampai ke source code retail-multitenant — lihat README.md) — filter
  // ulang manual di sini (`isWithinWibDayRange`, SAMA util dipakai `get_cash_opname_list`/
  // `get_purchase_order_list`/`get_direct_purchase_list`), jangan percaya hasil
  // Retailku apa adanya. Dilakukan di sini (bukan di helper `getSaleList`) karena
  // paginasinya multi-halaman — filter per-halaman di helper bisa bikin `totalPages`
  // loop-nya tidak konsisten dengan jumlah hasil akhir.
  return sales.filter((sale) => isWithinWibDayRange(sale.transactionDate, range.dateFrom, range.dateTo));
}

type SaleItemWithContext = {
  item: RetailkuSaleDetailItem;
  sale: RetailkuSaleDetail;
  isReceivable: boolean;
  accountId: string | undefined;
};

function flattenSaleItems(sales: RetailkuSaleDetail[]): SaleItemWithContext[] {
  const result: SaleItemWithContext[] = [];

  for (const sale of sales) {
    const isReceivable = sale.paymentLines.length === 0 && sale.outstandingAmount > 0;
    const accountId = sale.paymentLines[0]?.account.id;

    for (const item of sale.items) {
      result.push({ item, sale, isReceivable, accountId });
    }
  }

  return result;
}

function groupKey(productType: RetailkuSaleProductType | undefined, isReceivable: boolean, accountId: string | undefined) {
  return isReceivable ? `${productType ?? "UNKNOWN"}::receivable` : `${productType ?? "UNKNOWN"}::${accountId ?? "no-account"}`;
}

const PRODUCT_TYPE_LABELS: Record<RetailkuSaleProductType, string> = {
  MERCHANDISE: "Barang Dagang",
  MANUFACTURE: "Barang Produksi",
  SERVICE: "Jasa",
  PPOB: "PPOB",
  CONSIGNMENT: "Konsinyasi",
  RAW_MATERIAL: "Bahan Baku",
};

function productTypeLabel(productType: RetailkuSaleProductType | undefined) {
  return productType ? PRODUCT_TYPE_LABELS[productType] : "Lainnya";
}

function heading(text: string) {
  return { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] };
}

function bulletList(lines: string[]) {
  return {
    type: "bulletList",
    content: lines.map((text) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })),
  };
}

function toGroupDescription(group: SaleItemWithContext[]) {
  const productTotals = new Map<string, { quantity: number; unitName: string | null; totalPrice: number }>();
  for (const { item } of group) {
    const existing = productTotals.get(item.productName);
    if (existing) {
      existing.quantity += item.quantity;
      existing.totalPrice += item.totalPrice;
    } else {
      productTotals.set(item.productName, { quantity: item.quantity, unitName: item.unitName, totalPrice: item.totalPrice });
    }
  }
  const ringkasanLines = Array.from(productTotals.entries()).map(
    ([productName, t]) => `${productName} - ${t.quantity}${t.unitName ? ` ${t.unitName}` : ""} = ${formatCurrency(t.totalPrice, "IDR")}`
  );

  const customerTotals = new Map<string, number>();
  for (const { item, sale } of group) {
    const customerName = sale.customer?.name ?? "Pelanggan Umum";
    customerTotals.set(customerName, (customerTotals.get(customerName) ?? 0) + item.totalPrice);
  }
  const pembeliLines = Array.from(customerTotals.entries()).map(
    ([name, total]) => `${name} = ${formatCurrency(total, "IDR")}`
  );

  const saleNumbers = new Map<string, { customerName: string; date: string; totalPrice: number }>();
  for (const { item, sale } of group) {
    const existing = saleNumbers.get(sale.number);
    if (existing) {
      existing.totalPrice += item.totalPrice;
    } else {
      saleNumbers.set(sale.number, {
        customerName: sale.customer?.name ?? "Pelanggan Umum",
        date: new Date(sale.transactionDate).toLocaleDateString("id-ID"),
        totalPrice: item.totalPrice,
      });
    }
  }
  const detailLines = Array.from(saleNumbers.entries()).map(
    ([number, d]) => `${number} — ${d.date} — ${d.customerName} — ${formatCurrency(d.totalPrice, "IDR")}`
  );

  return {
    type: "doc",
    content: [
      heading("Ringkasan"),
      bulletList(ringkasanLines),
      heading("Pembeli"),
      bulletList(pembeliLines),
      heading("Detail Transaksi"),
      bulletList(detailLines),
    ],
  };
}

function toSaleSummaryEntries(sales: RetailkuSaleDetail[]): RetailkuPackageEntry[] {
  const flat = flattenSaleItems(sales);
  if (flat.length === 0) return [];

  const latestDate = sales.reduce((latest, sale) => (sale.transactionDate > latest ? sale.transactionDate : latest), sales[0].transactionDate);
  const date = toLocalDateTimeInputValue(latestDate);

  const groups = new Map<string, SaleItemWithContext[]>();
  for (const entry of flat) {
    const key = groupKey(entry.item.product?.type, entry.isReceivable, entry.accountId);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const entries: RetailkuPackageEntry[] = [];

  for (const [key, group] of groups) {
    const { isReceivable, accountId } = group[0];
    const productType = group[0].item.product?.type;
    const qty = group.length;
    const description = toGroupDescription(group);

    if (productType === "PPOB") {
      const totalCost = group.reduce((sum, g) => sum + g.item.totalCost, 0);
      const totalMargin = group.reduce((sum, g) => sum + (g.item.totalPrice - g.item.totalCost), 0);

      entries.push({
        id: `${key}-hpp`,
        label: `HPP PPOB${isReceivable ? " (Piutang)" : ""} (${qty})`,
        target: "transaction",
        defaultValues: {
          type: "transfer",
          amount: totalCost,
          transfer_account_id: isReceivable ? undefined : accountId,
          note: `HPP PPOB${isReceivable ? " (Piutang)" : ""}`,
          description,
          date,
        },
      });
      entries.push({
        id: `${key}-margin`,
        label: `Margin PPOB${isReceivable ? " (Piutang)" : ""} (${qty})`,
        target: "transaction",
        defaultValues: isReceivable
          ? {
              type: "transfer",
              amount: totalMargin,
              note: "Piutang Margin PPOB",
              description,
              date,
            }
          : {
              type: "income",
              amount: totalMargin,
              account_id: accountId,
              note: "Margin PPOB",
              description,
              date,
            },
      });
      continue;
    }

    if (productType === "CONSIGNMENT") {
      const totalTitip = group.reduce((sum, g) => sum + g.item.totalCost, 0);
      const totalKomisi = group.reduce((sum, g) => sum + (g.item.totalPrice - g.item.totalCost), 0);

      if (isReceivable) {
        entries.push({
          id: `${key}-titip`,
          label: `Konsinyasi — Bagian Penitip (Piutang) (${qty})`,
          target: "transaction",
          defaultValues: {
            type: "transfer",
            amount: totalTitip,
            note: "Piutang Konsinyasi (Bagian Penitip)",
            description,
            date,
          },
        });
      } else {
        entries.push({
          id: `${key}-titip`,
          label: `Konsinyasi — Bagian Penitip (${qty})`,
          target: "third-party-fund",
          defaultValues: {
            direction: "in",
            account_id: accountId,
            contact_name: null,
            amount: totalTitip,
            note: "Penjualan Konsinyasi",
            date,
          },
        });
      }
      entries.push({
        id: `${key}-komisi`,
        label: `Konsinyasi — Komisi${isReceivable ? " (Piutang)" : ""} (${qty})`,
        target: "transaction",
        defaultValues: isReceivable
          ? {
              type: "transfer",
              amount: totalKomisi,
              note: "Piutang Komisi Konsinyasi",
              description,
              date,
            }
          : {
              type: "income",
              amount: totalKomisi,
              account_id: accountId,
              note: "Komisi Konsinyasi",
              description,
              date,
            },
      });
      continue;
    }

    const total = group.reduce((sum, g) => sum + g.item.totalPrice, 0);
    const typeLabel = productTypeLabel(productType);
    entries.push({
      id: key,
      label: `${typeLabel}${isReceivable ? " (Piutang)" : ""} (${qty})`,
      target: "transaction",
      defaultValues: isReceivable
        ? {
            type: "transfer",
            amount: total,
            note: `Piutang Penjualan ${typeLabel}`,
            description,
            date,
          }
        : {
            type: "income",
            amount: total,
            account_id: accountId,
            note: `Omzet Dagang — ${typeLabel}`,
            description,
            date,
          },
    });
  }

  return entries;
}

export const getSaleEntry: RetailkuSummaryToolEntry = {
  mode: "summary",
  label: "Penjualan (Rangkuman)",
  fetchSummary: async (client, range) => {
    const sales = await fetchAllSales(client, range);
    return toSaleSummaryEntries(sales);
  },
};
