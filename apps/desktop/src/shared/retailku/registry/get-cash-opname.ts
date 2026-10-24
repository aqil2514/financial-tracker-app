import { formatCurrency } from "@/lib/format-currency";
import { getCashOpnameDetail } from "../helpers/tools/get_cash_opname_detail";
import { getCashOpnameList } from "../helpers/tools/get_cash_opname_list";
import type { RetailkuCashOpnameDetail } from "../types/tools/get_cash_opname_detail";
import type { DetailAdapter } from "../types";
import type { RetailkuPackageEntry, RetailkuToolEntry } from "./types";

const cashOpnameAdapter: DetailAdapter<RetailkuCashOpnameDetail> = (raw) => ({
  amount: formatCurrency(raw.difference, "IDR"),
  note: raw.notes || undefined,
  fields: [
    { label: "Tanggal", value: new Date(raw.countedAt).toLocaleDateString("id-ID") },
    { label: "Status", value: raw.status },
    { label: "Akun", value: raw.account?.name ?? "-" },
    { label: "Saldo Sistem", value: formatCurrency(raw.systemBalance, "IDR") },
    { label: "Fisik (Bersih)", value: formatCurrency(raw.netTotal, "IDR") },
    ...(raw.thirdPartyFunds ?? []).map((fund) => ({
      label: `Dana Pihak Ketiga — ${fund.label}`,
      value: formatCurrency(fund.amount, "IDR"),
    })),
    { label: "Dibuat Oleh", value: raw.createdBy?.name ?? "-" },
  ],
});

function toLocalDateTimeInputValue(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toCashOpnamePackage(raw: RetailkuCashOpnameDetail): RetailkuPackageEntry[] {
  const entries: RetailkuPackageEntry[] = [];
  const date = toLocalDateTimeInputValue(raw.countedAt);
  const sourceDetail = cashOpnameAdapter(raw);

  if (raw.difference !== 0) {
    entries.push({
      id: "difference",
      label: "Selisih Kas Opname",
      target: "transaction",
      defaultValues: {
        type: raw.difference > 0 ? "income" : "expense",
        amount: Math.abs(raw.difference),
        account_id: raw.account?.id,
        note: "Selisih Cash Opname",
        date,
        source_ref: `retailku-picker:${raw.id}`,
      },
      sourceDetail,
    });
  }

  for (const fund of raw.thirdPartyFunds ?? []) {
    entries.push({
      id: `third-party-fund-${fund.label}`,
      label: `Dana Pihak Ketiga — ${fund.label}`,
      target: "third-party-fund",
      defaultValues: {
        direction: "in",
        account_id: raw.account?.id,
        contact_name: fund.label,
        amount: fund.amount,
        date,
        note: fund.reason,
      },
      sourceDetail,
    });
  }

  return entries;
}

export const getCashOpnameEntry: RetailkuToolEntry = {
  label: "Cash Opname",
  fetchList: async (client, range) => {
    const result = await getCashOpnameList(client, range);
    return result.data.map((item) => ({
      id: item.id,
      label: new Date(item.countedAt).toLocaleDateString("id-ID"),
      description: formatCurrency(item.difference, "IDR"),
      raw: item,
    }));
  },
  fetchDetail: (client, id) => getCashOpnameDetail(client, id),
  adapter: cashOpnameAdapter as DetailAdapter,
  toPackage: (detail) => toCashOpnamePackage(detail as RetailkuCashOpnameDetail),
};
