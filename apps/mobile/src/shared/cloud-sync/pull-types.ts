// Bentuk respons GET /sync (apps/worker/src/modules/sync). Attachment sengaja tidak dimodelkan (jalur sendiri,
// Fase 5). Label dimodelkan lengkap: kamus dan tiga junction.
export type SyncRow = { id: string; updatedAt: string | null; deletedAt: string | null };

export type SyncResponse = {
  checkpoint: string;
  accountGroups: Array<SyncRow & { name: string }>;
  categories: Array<
    SyncRow & { name: string; icon: string | null; type: "income" | "expense"; parentId: string | null; isActive: boolean }
  >;
  contacts: Array<SyncRow & { name: string; note: string | null }>;
  labels: Array<SyncRow & { name: string; scope: "transaction_category" | "account" }>;
  transactionLabels: Array<SyncRow & { transactionId: string; labelId: string }>;
  categoryLabels: Array<SyncRow & { categoryId: string; labelId: string }>;
  accountLabels: Array<SyncRow & { accountId: string; labelId: string }>;
  accounts: Array<
    SyncRow & {
      name: string;
      icon: string | null;
      color: string | null;
      initialBalance: number;
      groupId: string | null;
      description: string | null;
      isActive: boolean;
      accountType: "cash" | "debt" | "investment" | "third_party" | "forex";
    }
  >;
  transactions: Array<
    SyncRow & {
      type: "income" | "expense" | "transfer";
      amount: number;
      categoryId: string | null;
      accountId: string | null;
      transferAccountId: string | null;
      note: string;
      date: string;
      description: string | null;
      contactId: string | null;
      isCashNeutral: boolean;
    }
  >;
  debts: Array<
    SyncRow & {
      type: "receivable" | "payable";
      contactId: string | null;
      amount: number;
      accountId: string | null;
      transactionId: string | null;
      status: "ongoing" | "paid" | "written_off";
      note: string | null;
      date: string;
    }
  >;
  debtPayments: Array<
    SyncRow & {
      debtId: string;
      amount: number;
      accountId: string | null;
      transactionId: string | null;
      note: string | null;
      date: string;
    }
  >;
  debtAccounts: Array<{
    accountId: string;
    direction: "receivable" | "payable";
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  investmentAccounts: Array<{
    accountId: string;
    unitLabel: string;
    currentMarketValue: number;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  investmentPurchases: Array<
    SyncRow & {
      accountId: string;
      transactionId: string | null;
      unit: number | null;
      pricePerUnit: number | null;
      date: string;
      status: "pending" | "settled";
    }
  >;
  investmentSales: Array<
    SyncRow & {
      accountId: string;
      transactionId: string | null;
      adjustmentTransactionId: string | null;
      unit: number;
      pricePerUnit: number;
      averageCostPerUnit: number | null;
      realizedPl: number | null;
      date: string;
      status: "pending" | "settled";
    }
  >;
  forexAccounts: Array<{
    accountId: string;
    country: string;
    currency: string;
    currentRate: number;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  forexPurchases: Array<
    SyncRow & {
      accountId: string;
      transactionId: string | null;
      unit: number;
      rate: number;
      date: string;
    }
  >;
  forexSales: Array<
    SyncRow & {
      accountId: string;
      transactionId: string | null;
      adjustmentTransactionId: string | null;
      unit: number;
      rate: number;
      averageCostPerUnit: number;
      realizedPl: number;
      date: string;
    }
  >;
  categoryPeriods: Array<SyncRow & { name: string; startDate: string; endDate: string; categoryIds: string[] }>;
  thirdPartyFunds: Array<
    SyncRow & {
      accountId: string;
      contactId: string;
      transactionId: string | null;
      direction: "in" | "out";
      amount: number;
      date: string;
      note: string | null;
    }
  >;
};
