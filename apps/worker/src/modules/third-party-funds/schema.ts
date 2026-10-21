import { isValidUpdatedAt } from "../../shared/lww";

// Payload POST /third-party-funds/push -- upsert-by-id MURNI utk baris
// third_party_funds yg desktop SUDAH buat sendiri
// (apply-third-party-transaction.ts lokal, jalur direct ATAU transfer,
// ATAU hasil edit lokal nominal/tanggal/catatan). transactionId nullable
// -- sejajar skema desktop (ON DELETE SET NULL), walau di praktiknya
// SELALU terisi saat push pertama kali (baris third_party_funds tanpa
// transaksi hanya terjadi kalau transaksi induknya dihapus duluan, yang
// justru berarti baris ini SEHARUSNYA sudah soft-deleted juga).
export type PushThirdPartyFundPayload = {
  id: string;
  accountId: string;
  contactId: string;
  transactionId: string | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  note?: string | null;
  updatedAt?: string;
};

export function isPushThirdPartyFundPayload(value: unknown): value is PushThirdPartyFundPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    typeof v.contactId === "string" &&
    v.contactId.length > 0 &&
    (v.transactionId === null || typeof v.transactionId === "string") &&
    (v.direction === "in" || v.direction === "out") &&
    typeof v.amount === "number" &&
    v.amount >= 0 &&
    typeof v.date === "string" &&
    (v.note === undefined || v.note === null || typeof v.note === "string") &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload POST /third-party-funds/direct -- titip/ambil LANGSUNG dipicu
// dari MCP (BUKAN jalur push, Worker SENDIRI yang insert transaksi
// income/expense + baris third_party_funds), pola PERSIS
// CreateDirectDebtPayload (debts/schema.ts) / CreateDirectInvestmentPurchasePayload
// (investments/schema.ts). contactId/contactName sama pola PushTransactionPayload
// (contactId eksplisit menang, contactName di-resolve get-or-create kalau
// contactId kosong) -- TAPI di sini WAJIB salah satu terisi (third_party_funds.contact_id
// NOT NULL, beda dari debts.contact_id yang nullable).
export type CreateDirectThirdPartyFundPayload = {
  id: string;
  direction: "in" | "out";
  amount: number;
  accountId: string;
  date: string;
  note?: string | null;
  contactId?: string | null;
  contactName?: string;
  updatedAt?: string;
};

export function isCreateDirectThirdPartyFundPayload(value: unknown): value is CreateDirectThirdPartyFundPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const contactNameValid = v.contactName === undefined || typeof v.contactName === "string";
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    (v.direction === "in" || v.direction === "out") &&
    typeof v.amount === "number" &&
    v.amount > 0 &&
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    typeof v.date === "string" &&
    (v.note === undefined || v.note === null || typeof v.note === "string") &&
    (v.contactId === undefined || v.contactId === null || typeof v.contactId === "string") &&
    contactNameValid &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}
