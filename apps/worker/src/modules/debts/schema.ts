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
