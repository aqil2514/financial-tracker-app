import type { AccountType } from "../account-types";

export type AccountGroup = { id: string; name: string; updatedAt: string | null; deletedAt: string | null };

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  parentId: string | null;
  isActive: boolean;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type Contact = { id: string; name: string; note: string | null; updatedAt: string | null; deletedAt: string | null };

export type Account = {
  id: string;
  name: string;
  icon: string | null;
  initialBalance: number;
  groupId: string | null;
  description: string | null;
  isActive: boolean;
  accountType: AccountType;
  color: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  transferAccountId: string | null;
  note: string;
  date: string;
  description: string | null;
  contactId: string | null;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  isCashNeutral: boolean;
};

export type Debt = {
  id: string;
  type: "receivable" | "payable";
  contactId: string | null;
  amount: number;
  accountId: string | null;
  transactionId: string | null;
  status: "ongoing" | "paid" | "written_off";
  note: string | null;
  date: string;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type DebtPayment = {
  id: string;
  debtId: string;
  amount: number;
  accountId: string | null;
  transactionId: string | null;
  note: string | null;
  date: string;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type DebtAccount = {
  accountId: string;
  direction: "receivable" | "payable";
  updatedAt: string | null;
  deletedAt: string | null;
};

export type InvestmentAccount = {
  accountId: string;
  unitLabel: string;
  currentMarketValue: number;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type InvestmentPurchase = {
  id: string;
  accountId: string;
  transactionId: string | null;
  unit: number | null;
  pricePerUnit: number | null;
  date: string;
  status: "pending" | "settled";
  updatedAt: string | null;
  deletedAt: string | null;
};

export type InvestmentSale = {
  id: string;
  accountId: string;
  transactionId: string | null;
  adjustmentTransactionId: string | null;
  unit: number;
  pricePerUnit: number;
  averageCostPerUnit: number | null;
  realizedPl: number | null;
  date: string;
  status: "pending" | "settled";
  updatedAt: string | null;
  deletedAt: string | null;
};

export type ThirdPartyFund = {
  id: string;
  accountId: string;
  contactId: string;
  transactionId: string | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  note: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type CategoryPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  categoryIds: string[];
  updatedAt: string | null;
  deletedAt: string | null;
};

export type Label = {
  id: string;
  name: string;
  scope: "transaction_category" | "account";
  updatedAt: string | null;
  deletedAt: string | null;
};

export type TransactionLabel = {
  id: string;
  transactionId: string;
  labelId: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type CategoryLabel = {
  id: string;
  categoryId: string;
  labelId: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type AccountLabel = {
  id: string;
  accountId: string;
  labelId: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type SyncSnapshot = {
  checkpoint: string;
  accountGroups: AccountGroup[];
  categories: Category[];
  contacts: Contact[];
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  debtAccounts: DebtAccount[];
  investmentAccounts: InvestmentAccount[];
  investmentPurchases: InvestmentPurchase[];
  investmentSales: InvestmentSale[];
  categoryPeriods: CategoryPeriod[];
  labels: Label[];
  transactionLabels: TransactionLabel[];
  categoryLabels: CategoryLabel[];
  accountLabels: AccountLabel[];
  thirdPartyFunds: ThirdPartyFund[];
};

export async function fetchFullSnapshot(
  workerFetch: <T>(path: string) => Promise<T>
): Promise<SyncSnapshot> {
  return workerFetch<SyncSnapshot>("/sync");
}
