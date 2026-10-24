import type { RetailkuFundTransferAccount } from "./get_fund_transfer_list";

export type RetailkuFundTransferDetail = {
  id: string;
  transactionDate: string;
  description: string | null;
  transferAmount: number;
  fromFee: number;
  toFee: number;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  fromAccount: RetailkuFundTransferAccount;
  toAccount: RetailkuFundTransferAccount;
};

export type RetailkuFundTransferDetailRaw = Omit<
  RetailkuFundTransferDetail,
  "transferAmount" | "fromFee" | "toFee"
> & {
  transferAmount: string;
  fromFee: string;
  toFee: string;
};
