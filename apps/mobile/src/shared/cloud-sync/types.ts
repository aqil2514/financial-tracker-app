export type CloudSyncCredentials = { workerUrl: string; token: string };

// Tabel yang punya jalur push. Urutan = urutan FK (induk dulu); delete diproses terbalik.
export const PUSH_TABLE_ORDER = [
  "account_groups",
  "categories",
  "contacts",
  "accounts",
  "category_periods",
  "transactions",
  "debts",
  "debt_payments",
  "investment_accounts",
  "investment_purchases",
  "investment_sales",
  "third_party_funds",
  "transaction_attachments",
] as const;

export type PushTable = (typeof PUSH_TABLE_ORDER)[number];

export type PushRequest = { path: string; body: Record<string, unknown> };
