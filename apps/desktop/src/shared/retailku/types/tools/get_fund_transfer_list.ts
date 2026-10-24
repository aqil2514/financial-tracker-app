export type RetailkuFundTransferAccount = {
  id: string;
  code: string;
  name: string;
};

export type RetailkuFundTransferListItem = {
  id: string;
  number: string;
  transactionDate: string;
  description: string | null;
  transferAmount: number;
  fromFee: number;
  toFee: number;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  fromAccount: RetailkuFundTransferAccount;
  toAccount: RetailkuFundTransferAccount;
};

export type RetailkuFundTransferList = {
  data: RetailkuFundTransferListItem[];
  total: number;
  page: number;
  limit: number;
};

export type RetailkuFundTransferListItemRaw = Omit<
  RetailkuFundTransferListItem,
  "transferAmount" | "fromFee" | "toFee"
> & {
  transferAmount: string;
  fromFee: string;
  toFee: string;
};

export type RetailkuFundTransferListRaw = Omit<RetailkuFundTransferList, "data"> & {
  data: RetailkuFundTransferListItemRaw[];
};
