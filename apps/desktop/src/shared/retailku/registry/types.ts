import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { TransactionFormValues } from "@/features/transactions/form/add-edit/schema";
import type { ThirdPartyFundFormValues } from "@/features/third-party/content/data/form/schemas";
import type { DetailAdapter, RetailkuPickerListItem } from "../types";

export type RetailkuToolDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type RetailkuTransactionDraft = {
  id: string;
  label: string;
  target: "transaction";
  defaultValues: Partial<TransactionFormValues>;
};

export type RetailkuThirdPartyFundDraft = {
  id: string;
  label: string;
  target: "third-party-fund";
  defaultValues: Partial<ThirdPartyFundFormValues>;
};

export type RetailkuPackageEntry = RetailkuTransactionDraft | RetailkuThirdPartyFundDraft;

export type RetailkuItemToolEntry = {
  mode?: "item";
  label: string;
  fetchList: (client: Client, range: RetailkuToolDateRange) => Promise<RetailkuPickerListItem[]>;
  fetchDetail: (client: Client, id: string) => Promise<unknown>;
  adapter: DetailAdapter;
  toPackage: (detail: unknown) => RetailkuPackageEntry[];
};

export type RetailkuSummaryToolEntry = {
  mode: "summary";
  label: string;
  fetchSummary: (client: Client, range: RetailkuToolDateRange) => Promise<RetailkuPackageEntry[]>;
};

export type RetailkuToolEntry = RetailkuItemToolEntry | RetailkuSummaryToolEntry;
