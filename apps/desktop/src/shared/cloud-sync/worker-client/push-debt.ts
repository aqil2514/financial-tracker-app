import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";
import type { TransactionSource } from "./transaction-source";

export type PushDebtPayload = {
  id: string;
  type: "receivable" | "payable";
  contactId?: string | null;
  amount: number;
  accountId?: string | null;
  transactionId: string;
  status?: "ongoing" | "paid" | "written_off";
  note?: string | null;
  date: string;
  source?: TransactionSource;
  sourceRef?: string | null;
  updatedAt?: string;
};

export function pushDebt(creds: CloudSyncCredentials, payload: PushDebtPayload) {
  return pushUpsert(creds, "/debts/push", payload);
}
