import { request } from "./request";
import type { CloudSyncCredentials } from "./types";
import { WorkerRequestError } from "./worker-request-error";

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
  | { table: "transaction_attachments" }
  | { table: "category_periods" };

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
  category_periods: "/category-periods/push",
};

export async function deleteCloudRow(
  creds: CloudSyncCredentials,
  table: DeleteCloudPayload["table"],
  id: string,
  payload?: Omit<Extract<DeleteCloudPayload, { table: typeof table }>, "table">
): Promise<void> {
  const body = payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
  try {
    await request(creds, `${DELETE_PATH[table]}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      ...(body ? { body } : {}),
    });
  } catch (err) {
    // 404 "not found" berarti row yang dituju MEMANG sudah tidak ada di
    // cloud -- hasil akhirnya sama dgn delete sukses (idempotent), jangan
    // diperlakukan sbg gagal. Tanpa ini, retry antrian bisa stuck
    // selamanya (gap ditemukan 2026-10-21: entry retry puluhan kali tanpa
    // pernah bisa keluar dari cloud_sync_queue krn row sumbernya sendiri
    // tidak pernah berhasil ter-push lebih dulu).
    if (err instanceof WorkerRequestError && err.status === 404) return;
    throw err;
  }
}
