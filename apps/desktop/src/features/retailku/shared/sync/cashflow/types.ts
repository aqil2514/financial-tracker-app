import type { getDb } from "@/lib/db";
import type { FieldMappingExtraFields, RetailkuMcpConfig } from "@/shared/retailku";
import type { RetailkuArApExistingMode, RetailkuCashflowSyncMode } from "../use-retailku-cashflow-sync-settings";

export type Db = Awaited<ReturnType<typeof getDb>>;

export type SyncCashflowInput = {
  mcpConfig: RetailkuMcpConfig;
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
  arApExistingMode: RetailkuArApExistingMode;
};

export type SyncCashflowResult = {
  insertedCount: number;
  insertedSourceRefs: string[];
  unmappedKeys: string[];
  deactivatedPaymentMethodAccountIds: string[];
  arApInsertedCount: number;
  arApInsertedSourceRefs: string[];
  arApUpdatedCount: number;
  arApUnmappedDebtKeys: string[];
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
  arAp: ArApSyncPlan;
};

export type ArApSkipReason =
  | "already-synced"
  | "unmapped-debt-account"
  | "zero-amount"
  | "negative-amount-not-supported";

export type ArApSyncPlanRow = {
  journalItemId: string;
  date: string;
  accountId: string;
  accountName: string;
  direction: "receivable" | "payable";
  kind: "trade" | "non-trade" | null;
  partyName: string | null;
  amount: number;
  sourceRef: string;
  key: string;
  willInsert: boolean;
  /** true = baris ini sudah pernah sync SEBELUMNYA dan mode "overwrite"
   * aktif — insertArApTransaction akan UPDATE debts.id ini, bukan
   * INSERT baru. existingDebtId wajib terisi kalau ini true. */
  willUpdate: boolean;
  existingDebtId: number | null;
  skipReason: ArApSkipReason | null;
  debtLocalAccountId: number | null;
  contactId: number | null;
  contactFollowSource: boolean;
};

export type ArApSyncPlan = {
  rows: ArApSyncPlanRow[];
  unmappedDebtKeys: string[];
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
  extraFields: FieldMappingExtraFields;
};
