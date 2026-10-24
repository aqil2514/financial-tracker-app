import { formatCurrency } from "@/lib/format-currency";
import { getInvestmentDetail } from "../helpers/tools/get_investment_detail";
import { getInvestmentList } from "../helpers/tools/get_investment_list";
import type { RetailkuInvestmentDetail } from "../types/tools/get_investment_detail";
import type { DetailAdapter } from "../types";
import type { RetailkuPackageEntry, RetailkuToolEntry } from "./types";

const investmentAdapter: DetailAdapter<RetailkuInvestmentDetail> = (raw) => ({
  amount: formatCurrency(raw.amount, "IDR"),
  note: raw.notes || undefined,
  fields: [
    { label: "Tanggal", value: new Date(raw.date).toLocaleDateString("id-ID") },
    { label: "Status", value: raw.status },
    { label: "Akun Kas", value: raw.cashAccount.name },
    { label: "Akun Investasi", value: raw.investmentAccount.name },
  ],
});

function toLocalDateTimeInputValue(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toInvestmentPackage(raw: RetailkuInvestmentDetail): RetailkuPackageEntry[] {
  const date = toLocalDateTimeInputValue(raw.date);

  return [
    {
      id: "buy",
      label: "Pembelian Investasi",
      target: "transaction",
      defaultValues: {
        type: "transfer",
        amount: raw.amount,
        account_id: raw.cashAccount.id,
        transfer_account_id: raw.investmentAccount.id,
        note: raw.notes || "Pembelian Investasi Retailku",
        date,
        investment_status: raw.status === "POSTED" ? "settled" : "pending",
      },
      sourceDetail: investmentAdapter(raw),
    },
  ];
}

export const getInvestmentEntry: RetailkuToolEntry = {
  label: "Pembelian Investasi",
  fetchList: async (client, range) => {
    const result = await getInvestmentList(client, range);
    return result.data.map((item) => ({
      id: item.id,
      label: new Date(item.date).toLocaleDateString("id-ID"),
      description: `${item.investmentAccount.name} — ${formatCurrency(item.amount, "IDR")}`,
      raw: item,
    }));
  },
  fetchDetail: (client, id) => getInvestmentDetail(client, id),
  adapter: investmentAdapter as DetailAdapter,
  toPackage: (detail) => toInvestmentPackage(detail as RetailkuInvestmentDetail),
};
