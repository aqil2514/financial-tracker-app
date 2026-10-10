import type { AccountType } from "@/lib/account-types";
import { request } from "./request";
import type { CloudSyncCredentials } from "./types";
import type { LabelScope } from "./label-scope";
import type { TransactionSource } from "./transaction-source";

export type SyncRow = { id: string; updatedAt: string | null; deletedAt: string | null };

export type SyncResponse = {
  checkpoint: string;
  accountGroups: Array<SyncRow & { name: string }>;
  categories: Array<
    SyncRow & {
      name: string;
      icon: string | null;
      type: "income" | "expense";
      parentId: string | null;
      isActive: boolean;
    }
  >;
  contacts: Array<SyncRow & { name: string; note: string | null }>;
  accounts: Array<
    SyncRow & {
      name: string;
      icon: string | null;
      initialBalance: number;
      groupId: string | null;
      description: string | null;
      isActive: boolean;
      accountType: AccountType;
      color: string | null;
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
      source: TransactionSource;
      sourceRef: string | null;
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
      source: TransactionSource;
      sourceRef: string | null;
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
      source: TransactionSource;
      sourceRef: string | null;
    }
  >;
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
  labels: Array<SyncRow & { name: string; scope: LabelScope }>;
  transactionLabels: Array<SyncRow & { transactionId: string; labelId: string }>;
  categoryLabels: Array<SyncRow & { categoryId: string; labelId: string }>;
  accountLabels: Array<SyncRow & { accountId: string; labelId: string }>;
};

export function pullSync(creds: CloudSyncCredentials, since: string | null): Promise<SyncResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return request<SyncResponse>(creds, `/sync${query}`);
}
