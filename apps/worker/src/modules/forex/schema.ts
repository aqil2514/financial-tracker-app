import { isValidUpdatedAt } from "../../shared/lww";

// Payload POST /forex/accounts/push -- upsert-by-id murni untuk baris forex_accounts yang desktop/mobile
// SUDAH buat sendiri. accountId adalah PK (1:1 dengan accounts), bukan `id` generik.
export type PushForexAccountPayload = {
  accountId: string;
  country: string;
  currency: string;
  currentRate: number;
  updatedAt?: string;
};

export function isPushForexAccountPayload(value: unknown): value is PushForexAccountPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    typeof v.country === "string" &&
    typeof v.currency === "string" &&
    typeof v.currentRate === "number" &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload POST /forex/purchases/push -- upsert-by-id murni untuk forex_purchases yang klien SUDAH buat lokal.
// transactionId wajib (FK ke transaksi yang sudah/akan di-push lebih dulu).
export type PushForexPurchasePayload = {
  id: string;
  accountId: string;
  transactionId: string;
  unit: number;
  rate: number;
  date: string;
  updatedAt?: string;
};

export function isPushForexPurchasePayload(value: unknown): value is PushForexPurchasePayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    typeof v.transactionId === "string" &&
    v.transactionId.length > 0 &&
    typeof v.unit === "number" &&
    typeof v.rate === "number" &&
    typeof v.date === "string" &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload POST /forex/sales/push -- upsert-by-id murni untuk forex_sales yang klien SUDAH buat lokal.
// Penjualan valas selalu langsung final (tanpa pending), jadi average cost dan realized P/L selalu terisi.
export type PushForexSalePayload = {
  id: string;
  accountId: string;
  transactionId: string;
  adjustmentTransactionId: string | null;
  unit: number;
  rate: number;
  averageCostPerUnit: number;
  realizedPl: number;
  date: string;
  updatedAt?: string;
};

export function isPushForexSalePayload(value: unknown): value is PushForexSalePayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    typeof v.transactionId === "string" &&
    v.transactionId.length > 0 &&
    (v.adjustmentTransactionId === null || typeof v.adjustmentTransactionId === "string") &&
    typeof v.unit === "number" &&
    typeof v.rate === "number" &&
    typeof v.averageCostPerUnit === "number" &&
    typeof v.realizedPl === "number" &&
    typeof v.date === "string" &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload POST /forex/purchases -- Worker SENDIRI menulis transaksi + baris riwayat (klien tanpa jalur tulis
// lokal, mis. MCP). cashAccountId null = tanpa akun kas (income langsung ke akun valas).
// `id` dipakai sebagai kunci idempotensi: kirim ulang id yang sama mengembalikan hasil lama.
export type CreateForexPurchasePayload = {
  id: string;
  forexAccountId: string;
  cashAccountId: string | null;
  unit: number;
  rate: number;
  date: string;
  note?: string | null;
};

export function isCreateForexPurchasePayload(value: unknown): value is CreateForexPurchasePayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.forexAccountId === "string" &&
    v.forexAccountId.length > 0 &&
    (v.cashAccountId === null || (typeof v.cashAccountId === "string" && v.cashAccountId.length > 0)) &&
    typeof v.unit === "number" &&
    typeof v.rate === "number" &&
    typeof v.date === "string" &&
    (v.note === undefined || v.note === null || typeof v.note === "string")
  );
}

// Payload POST /forex/sales -- sama alasan dengan pembelian di atas. Kas tujuan wajib (tidak ada penjualan
// tanpa akun kas), id sebagai kunci idempotensi.
export type SellForexPayload = {
  id: string;
  forexAccountId: string;
  cashAccountId: string;
  unit: number;
  rate: number;
  date: string;
  note?: string | null;
};

export function isSellForexPayload(value: unknown): value is SellForexPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.forexAccountId === "string" &&
    v.forexAccountId.length > 0 &&
    typeof v.cashAccountId === "string" &&
    v.cashAccountId.length > 0 &&
    typeof v.unit === "number" &&
    typeof v.rate === "number" &&
    typeof v.date === "string" &&
    (v.note === undefined || v.note === null || typeof v.note === "string")
  );
}
