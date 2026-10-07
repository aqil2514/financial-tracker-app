import { isValidUpdatedAt } from "../../shared/lww";

// Payload POST /investments/accounts/push -- upsert-by-id MURNI utk baris
// investment_accounts yg desktop SUDAH buat sendiri (form akun investasi
// lokal, account_type='investment'). accountId adalah PK (1:1 dgn
// accounts) -- BUKAN `id` generik spt tabel lain, lihat skema
// schema/0002_account_type_investment.sql.
export type PushInvestmentAccountPayload = {
  accountId: string;
  unitLabel: string;
  currentMarketValue: number;
  updatedAt?: string;
};

export function isPushInvestmentAccountPayload(value: unknown): value is PushInvestmentAccountPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    typeof v.unitLabel === "string" &&
    typeof v.currentMarketValue === "number" &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload POST /investments/purchases/push -- upsert-by-id MURNI utk baris
// investment_purchases yg desktop SUDAH buat sendiri (apply-investment-
// transaction.ts lokal, ATAU hasil edit settlement lewat
// shared/investments/edit-purchase-form/). transactionId WAJIB (FK ke
// transactions yg SUDAH ada/sudah di-push lebih dulu). unit/pricePerUnit
// nullable -- order pending yg belum tahu nilai pasti, sama alasan dgn
// skema desktop (migrasi 0038).
export type PushInvestmentPurchasePayload = {
  id: string;
  accountId: string;
  transactionId: string;
  unit: number | null;
  pricePerUnit: number | null;
  date: string;
  status?: "pending" | "settled";
  updatedAt?: string;
};

export function isPushInvestmentPurchasePayload(value: unknown): value is PushInvestmentPurchasePayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    typeof v.transactionId === "string" &&
    v.transactionId.length > 0 &&
    (v.unit === null || typeof v.unit === "number") &&
    (v.pricePerUnit === null || typeof v.pricePerUnit === "number") &&
    typeof v.date === "string" &&
    (v.status === undefined || v.status === "pending" || v.status === "settled") &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}
