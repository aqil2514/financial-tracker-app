import { isValidUpdatedAt } from "../../shared/lww";

// Payload POST /debts -- khusus mode 'direct' (lihat
// docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md pertanyaan #7):
// piutang/utang TANPA transaksi KAS (uang sudah berpindah di luar app),
// account_id WAJIB (akun bertipe 'debt', prinsip #1 konsep-tipe-akun.md).
// service.ts (createDirectDebt) TETAP membuat 1 transaksi penutup
// income/expense langsung pada akun debt itu sendiri -- transaction_id
// TIDAK NULL (lihat koreksi 2026-10-04 di service.ts). Mode 'transfer'
// (piutang lahir dari transfer kas<->debt) SUDAH bisa lewat
// POST /transactions + debtAction -- TIDAK diulang di sini.
export type CreateDirectDebtPayload = {
  id: string;
  type: "receivable" | "payable";
  amount: number;
  accountId: string;
  date: string;
  note?: string | null;
  contactId?: string | null;
  contactName?: string;
  updatedAt?: string;
};

export function isCreateDirectDebtPayload(value: unknown): value is CreateDirectDebtPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const contactNameValid = v.contactName === undefined || typeof v.contactName === "string";
  return (
    typeof v.id === "string" &&
    (v.type === "receivable" || v.type === "payable") &&
    typeof v.amount === "number" &&
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    typeof v.date === "string" &&
    (v.note === undefined || v.note === null || typeof v.note === "string") &&
    (v.contactId === undefined || v.contactId === null || typeof v.contactId === "string") &&
    contactNameValid &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload POST /debts/:id/payments -- khusus settlement 'non_cash' (lihat
// pay-debt-form/use-pay-debt.ts di desktop): pelunasan TANPA uang
// berpindah sama sekali (barter/pemutihan/offset). transaction_id selalu
// NULL. Settlement 'cash' SUDAH bisa lewat POST /transactions
// (type=transfer, debtAction=settlement) -- TIDAK diulang di sini.
export type CreateNonCashPaymentPayload = {
  id: string;
  amount: number;
  date: string;
  note?: string | null;
  updatedAt?: string;
};

export function isCreateNonCashPaymentPayload(value: unknown): value is CreateNonCashPaymentPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.amount === "number" &&
    v.amount > 0 &&
    typeof v.date === "string" &&
    (v.note === undefined || v.note === null || typeof v.note === "string") &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload POST /debts/push -- khusus baris debts yg desktop SUDAH bikin
// sendiri lewat apply-debt-transaction.ts lokal (transfer cash<->debt),
// dipush APA ADANYA (upsert-by-id MURNI, TANPA transaksi closing --
// beda dari CreateDirectDebtPayload yg transactionId-nya didapat dari
// createDebtClosingTransaction internal). `id`/`transactionId` WAJIB
// krn baris ini turunan dari transaksi yg SUDAH ada, bukan entity baru
// berdiri sendiri. Lihat docs/todos/plan/fix-debts-duplikasi-sync.md.
export type PushDebtPayload = {
  id: string;
  type: "receivable" | "payable";
  contactId?: string | null;
  amount: number;
  accountId?: string | null;
  transactionId: string;
  status?: "ongoing" | "paid" | "written_off";
  note?: string | null;
  date: string;
  // Provenance baris (kolom `source`/`source_ref`) -- WAJIB ikut apa
  // adanya, PERSIS pola PushTransactionPayload di transactions/schema.ts,
  // supaya baris hasil sync Retailku tidak jatuh jadi 'manual' di D1.
  source?: "manual" | "retailku_sync";
  sourceRef?: string | null;
  updatedAt?: string;
};

export function isPushDebtPayload(value: unknown): value is PushDebtPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    (v.type === "receivable" || v.type === "payable") &&
    (v.contactId === undefined || v.contactId === null || typeof v.contactId === "string") &&
    typeof v.amount === "number" &&
    (v.accountId === undefined || v.accountId === null || typeof v.accountId === "string") &&
    typeof v.transactionId === "string" &&
    v.transactionId.length > 0 &&
    (v.status === undefined || v.status === "ongoing" || v.status === "paid" || v.status === "written_off") &&
    (v.note === undefined || v.note === null || typeof v.note === "string") &&
    typeof v.date === "string" &&
    (v.source === undefined || v.source === "manual" || v.source === "retailku_sync") &&
    (v.sourceRef === undefined || v.sourceRef === null || typeof v.sourceRef === "string") &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload POST /debt-payments/push -- sejajar PushDebtPayload, utk
// baris debt_payments yg desktop sudah bikin sendiri (settlement FIFO
// atau insert manual langsung). debtId WAJIB (FK ke debts, SUDAH ada
// baik dari push debt sebelumnya atau baris lama).
export type PushDebtPaymentPayload = {
  id: string;
  debtId: string;
  amount: number;
  accountId?: string | null;
  transactionId?: string | null;
  note?: string | null;
  date: string;
  source?: "manual" | "retailku_sync";
  sourceRef?: string | null;
  updatedAt?: string;
};

export function isPushDebtPaymentPayload(value: unknown): value is PushDebtPaymentPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.debtId === "string" &&
    v.debtId.length > 0 &&
    typeof v.amount === "number" &&
    (v.accountId === undefined || v.accountId === null || typeof v.accountId === "string") &&
    (v.transactionId === undefined || v.transactionId === null || typeof v.transactionId === "string") &&
    (v.note === undefined || v.note === null || typeof v.note === "string") &&
    typeof v.date === "string" &&
    (v.source === undefined || v.source === "manual" || v.source === "retailku_sync") &&
    (v.sourceRef === undefined || v.sourceRef === null || typeof v.sourceRef === "string") &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}
