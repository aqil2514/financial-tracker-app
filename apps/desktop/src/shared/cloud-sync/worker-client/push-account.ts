import type { AccountType } from "@/lib/account-types";
import type { CloudSyncCredentials } from "./types";
import { pushUpsert } from "./push-upsert";

export type PushAccountPayload = {
  id: string;
  name: string;
  initialBalance: number;
  groupId?: string | null;
  description?: string | null;
  isActive?: boolean;
  accountType: AccountType;
  icon?: string | null;
  color?: string | null;
  updatedAt?: string;
  // Hanya relevan saat accountType === 'debt' (lihat debt_accounts di
  // Worker, upsertAccount) -- beda dari investment_accounts yang punya
  // endpoint push sendiri, `direction` dikirim bareng payload /accounts
  // ini karena Worker sudah menerimanya sbg field opsional di sini.
  direction?: "receivable" | "payable" | null;
};

export function pushAccount(creds: CloudSyncCredentials, payload: PushAccountPayload) {
  return pushUpsert(creds, "/accounts", payload);
}
