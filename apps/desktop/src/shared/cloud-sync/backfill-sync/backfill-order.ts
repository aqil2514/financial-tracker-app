import type { QueueableTable } from "../push-queue";

export const BACKFILL_ORDER: QueueableTable[] = [
  "account_groups",
  "categories",
  "contacts",
  "accounts",
  "transactions",
  "transaction_attachments",
  // Valas: data yang dicatat sebelum Worker mengenal tipe forex baru bisa di-push ulang dari sini. Setelah
  // transactions karena forex_purchases/forex_sales punya FK ke transaksi.
  "forex_accounts",
  "forex_purchases",
  "forex_sales",
];
