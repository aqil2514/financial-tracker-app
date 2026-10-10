import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";
import type { TransactionSource } from "./transaction-source";

export type PushTransactionPayload = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  note: string;
  date: string;
  categoryId?: string | null;
  accountId?: string | null;
  transferAccountId?: string | null;
  description?: string | null;
  contactId?: string | null;
  debtAction?: "settlement" | "payable" | null;
  settleDebtIds?: string[];
  source?: TransactionSource;
  sourceRef?: string | null;
  updatedAt?: string;
};

export function pushTransaction(creds: CloudSyncCredentials, payload: PushTransactionPayload) {
  return pushUpsert(creds, "/transactions", payload);
}
