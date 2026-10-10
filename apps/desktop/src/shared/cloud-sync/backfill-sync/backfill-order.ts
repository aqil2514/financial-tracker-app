import type { QueueableTable } from "../push-queue";

export const BACKFILL_ORDER: QueueableTable[] = [
  "account_groups",
  "categories",
  "contacts",
  "accounts",
  "transactions",
  "transaction_attachments",
];
