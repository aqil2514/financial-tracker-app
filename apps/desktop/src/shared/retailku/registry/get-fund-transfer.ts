import { formatCurrency } from "@/lib/format-currency";
import { getFundTransferDetail } from "../helpers/tools/get_fund_transfer_detail";
import { getFundTransferList } from "../helpers/tools/get_fund_transfer_list";
import type { RetailkuFundTransferDetail } from "../types/tools/get_fund_transfer_detail";
import type { DetailAdapter } from "../types";
import type { RetailkuPackageEntry, RetailkuToolEntry } from "./types";

const fundTransferAdapter: DetailAdapter<RetailkuFundTransferDetail> = (raw) => ({
  amount: formatCurrency(raw.transferAmount, "IDR"),
  note: raw.description || undefined,
  fields: [
    { label: "Tanggal", value: new Date(raw.transactionDate).toLocaleDateString("id-ID") },
    { label: "Status", value: raw.status },
    { label: "Dari Akun", value: raw.fromAccount.name },
    { label: "Ke Akun", value: raw.toAccount.name },
    { label: "Biaya Asal", value: formatCurrency(raw.fromFee, "IDR") },
    { label: "Biaya Tujuan", value: formatCurrency(raw.toFee, "IDR") },
  ],
});

function toLocalDateTimeInputValue(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toFundTransferPackage(raw: RetailkuFundTransferDetail): RetailkuPackageEntry[] {
  const entries: RetailkuPackageEntry[] = [];
  const date = toLocalDateTimeInputValue(raw.transactionDate);

  entries.push({
    id: "transfer",
    label: "Transfer Dana",
    target: "transaction",
    defaultValues: {
      type: "transfer",
      amount: raw.transferAmount,
      account_id: raw.fromAccount.id,
      transfer_account_id: raw.toAccount.id,
      note: raw.description || "Transfer Dana Retailku",
      date,
    },
  });

  if (raw.fromFee > 0) {
    entries.push({
      id: "from-fee",
      label: "Biaya Transfer (Asal)",
      target: "transaction",
      defaultValues: {
        type: "expense",
        amount: raw.fromFee,
        account_id: raw.fromAccount.id,
        note: "Biaya Transfer Dana",
        date,
      },
    });
  }

  if (raw.toFee > 0) {
    entries.push({
      id: "to-fee",
      label: "Biaya Transfer (Tujuan)",
      target: "transaction",
      defaultValues: {
        type: "expense",
        amount: raw.toFee,
        account_id: raw.toAccount.id,
        note: "Biaya Transfer Dana",
        date,
      },
    });
  }

  return entries;
}

export const getFundTransferEntry: RetailkuToolEntry = {
  label: "Transfer Dana",
  fetchList: async (client, range) => {
    const result = await getFundTransferList(client, range);
    return result.data.map((item) => ({
      id: item.id,
      label: new Date(item.transactionDate).toLocaleDateString("id-ID"),
      description: `${item.fromAccount.name} → ${item.toAccount.name} — ${formatCurrency(item.transferAmount, "IDR")}`,
      raw: item,
    }));
  },
  fetchDetail: (client, id) => getFundTransferDetail(client, id),
  adapter: fundTransferAdapter as DetailAdapter,
  toPackage: (detail) => toFundTransferPackage(detail as RetailkuFundTransferDetail),
};
