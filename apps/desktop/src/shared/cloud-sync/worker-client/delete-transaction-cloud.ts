import { request } from "./request";
import type { CloudSyncCredentials } from "./types";

export type TransactionDebtInfo =
  | { role: "none" }
  | { role: "payment"; debtId: string }
  | { role: "principal"; debtId: string; hadPayments: boolean };

export async function deleteTransactionCloud(creds: CloudSyncCredentials, id: string): Promise<TransactionDebtInfo> {
  const result = await request<{ debtInfo: TransactionDebtInfo }>(creds, `/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return result.debtInfo;
}
