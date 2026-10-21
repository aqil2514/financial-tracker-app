import type { AccountType } from "../account-types";

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  parent_id: string | null;
  is_active: number;
};

export type CategoryPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

export type CategoryPeriodCategory = {
  id: string;
  period_id: string;
  category_id: string;
};

export type AccountGroup = {
  id: string;
  name: string;
  created_at: string;
};

export type Account = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  initial_balance: number;
  group_id: string | null;
  description: string | null;
  created_at: string;
  is_active: number;
  account_type: AccountType;
};

export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category_id: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  note: string;
  description: string | null;
  date: string;
  created_at: string;
  contact_id: string | null;
};

export type Contact = {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
};

export type Debt = {
  id: string;
  type: "receivable" | "payable";
  contact_id: string | null;
  amount: number;
  account_id: string | null;
  transaction_id: string | null;
  status: "ongoing" | "paid" | "written_off";
  note: string | null;
  date: string;
  created_at: string;
};

export type DebtPayment = {
  id: string;
  debt_id: string;
  amount: number;
  account_id: string | null;
  transaction_id: string | null;
  note: string | null;
  date: string;
  created_at: string;
};

export type ThirdPartyFund = {
  id: string;
  account_id: string;
  contact_id: string;
  transaction_id: string | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
};
