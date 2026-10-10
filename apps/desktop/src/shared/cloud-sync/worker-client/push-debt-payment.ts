import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";
import type { TransactionSource } from "./transaction-source";

export type PushDebtPaymentPayload = {
  id: string;
  debtId: string;
  amount: number;
  accountId?: string | null;
  transactionId?: string | null;
  note?: string | null;
  date: string;
  source?: TransactionSource;
  sourceRef?: string | null;
  updatedAt?: string;
};

export function pushDebtPayment(creds: CloudSyncCredentials, payload: PushDebtPaymentPayload) {
  return pushUpsert(creds, "/debts/payments/push", payload);
}
