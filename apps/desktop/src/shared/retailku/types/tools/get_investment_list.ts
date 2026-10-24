export type RetailkuInvestmentAccount = {
  id: string;
  code: string;
  name: string;
};

export type RetailkuInvestmentListItem = {
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

export type RetailkuInvestmentList = {
  data: RetailkuInvestmentListItem[];
  total: number;
  page: number;
  limit: number;
};

export type RetailkuInvestmentListItemRaw = Omit<
  RetailkuInvestmentListItem,
  "amount" | "capitalAmount" | "gainLoss"
> & {
  amount: string;
  capitalAmount: string | null;
  gainLoss: string | null;
};

export type RetailkuInvestmentListRaw = Omit<RetailkuInvestmentList, "data"> & {
  data: RetailkuInvestmentListItemRaw[];
};
