import { request } from "./request";
import type { CloudSyncCredentials } from "./types";

export type DeleteCloudPayload =
  | { table: "account_groups"; memberAction?: "unassign" | "reassign"; targetGroupId?: string }
  | { table: "accounts"; transactionAction?: "unassign" | "reassign"; targetAccountId?: string }
  | {
      table: "categories";
      childAction?: "unassign" | "reassign";
      targetParentId?: string;
      transactionAction?: "unassign" | "reassign";
      targetCategoryId?: string;
    }
  | { table: "contacts" }
  | { table: "transactions" }
  | { table: "debts" }
  | { table: "debt_payments" }
  | { table: "investment_purchases" }
  | { table: "investment_sales" }
  | { table: "transaction_attachments" };

const DELETE_PATH: Record<DeleteCloudPayload["table"], string> = {
  account_groups: "/account-groups",
  accounts: "/accounts",
  categories: "/categories",
  contacts: "/contacts",
  investment_purchases: "/investments/purchases/push",
  investment_sales: "/investments/sales/push",
  transactions: "/transactions",
  debts: "/debts/push",
  debt_payments: "/debts/payments/push",
  transaction_attachments: "/attachments",
};

export async function deleteCloudRow(
  creds: CloudSyncCredentials,
  table: DeleteCloudPayload["table"],
  id: string,
  payload?: Omit<Extract<DeleteCloudPayload, { table: typeof table }>, "table">
): Promise<void> {
  const body = payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
  await request(creds, `${DELETE_PATH[table]}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    ...(body ? { body } : {}),
  });
}
