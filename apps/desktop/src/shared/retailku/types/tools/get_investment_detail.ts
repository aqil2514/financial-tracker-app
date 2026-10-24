import type { RetailkuInvestmentAccount } from "./get_investment_list";

export type RetailkuInvestmentDetail = {
  id: string;
  number: string;
  type: "BUY" | "REDEEM" | "OPENING_BALANCE";
  status: "PENDING" | "POSTED" | "CANCELLED";
  date: string;
  amount: number;
  capitalAmount: number | null;
  gainLoss: number | null;
  notes: string;
  cashAccount: RetailkuInvestmentAccount;
  investmentAccount: RetailkuInvestmentAccount;
};

export type RetailkuInvestmentDetailRaw = Omit<
  RetailkuInvestmentDetail,
  "amount" | "capitalAmount" | "gainLoss"
> & {
  amount: string;
  capitalAmount: string | null;
  gainLoss: string | null;
};
