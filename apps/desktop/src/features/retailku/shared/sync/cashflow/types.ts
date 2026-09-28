import type { getDb } from "@/lib/db";
import type { RetailkuMcpConfig } from "@/shared/retailku";
import type { RetailkuCashflowSyncMode } from "../use-retailku-cashflow-sync-settings";

export type Db = Awaited<ReturnType<typeof getDb>>;

export type SyncCashflowInput = {
  mcpConfig: RetailkuMcpConfig;
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
};

export type SyncCashflowResult = {
  insertedCount: number;
  insertedSourceRefs: string[];
  unmappedKeys: string[];
  deactivatedPaymentMethodAccountIds: string[];
};

export type CashflowSyncPlanRow = {
  date: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  net: number;
  note: string;
  categoryId: number | null;
  description: string | null;
  key: string;
  sourceRef: string;
  willInsert: boolean;
  skipReason: "already-synced" | "unmapped-account" | "deactivated-payment-method" | null;
  localAccountId: number | null;
};

export type CashflowSyncPlan = {
  rows: CashflowSyncPlanRow[];
  unmappedKeys: string[];
  deactivatedPaymentMethodAccountIds: string[];
};

export type AggregatedTotal = {
  date: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  net: number;
  note: string;
  key: string;
  sourceRef: string;
};

export type RetailkuSyncFieldMappingRow = {
  key: string;
  localAccountId: number;
  note: string | null;
  categoryId: number | null;
  description: string | null;
};
