import type { DeleteCloudPayload } from "../worker-client";

export type QueueableTable =
  | "transactions"
  | "accounts"
  | "account_groups"
  | "categories"
  | "contacts"
  | "debts"
  | "debt_payments"
  | "investment_accounts"
  | "investment_purchases"
  | "investment_sales"
  | "transaction_attachments"
  | "labels"
  | "transaction_labels"
  | "category_labels"
  | "account_labels";

export type DeletableTable = DeleteCloudPayload["table"];
