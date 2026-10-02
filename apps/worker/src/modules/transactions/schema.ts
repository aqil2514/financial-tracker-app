import { isValidUpdatedAt } from "../../shared/lww";

// Payload dari PC/MCP utk push satu baris transaksi. `updatedAt`
// opsional -- lihat shared/lww.ts utk kontrak LWW lengkap.
export type PushTransactionPayload = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  note: string;
  date: string;
  categoryId?: string | null;
  accountId?: string | null;
  transferAccountId?: string | null;
  description?: string | null;
  contactId?: string | null;
  // Hanya relevan saat type='transfer' DAN arah debt->cash (ambigu
  // antara pelunasan piutang existing vs utang baru) -- lihat logic
  // #1 di mcp-server-business-logic-audit.md, port dari
  // apply-debt-transaction.ts (ApplyDebtTransactionInput).
  debtAction?: "settlement" | "payable" | null;
  // debts.id yang dipilih utk dilunasi, cuma dipakai saat
  // debtAction === 'settlement'.
  settleDebtIds?: string[];
  // Provenance baris -- SAMA dgn kolom `source`/`source_ref` di PC
  // (0017_transaction_source.sql) & D1 (0001_initial.sql). Opsional:
  // tidak dikirim -> INSERT jatuh ke default kolom ('manual'/NULL),
  // UPDATE mempertahankan nilai yg sudah ada (lihat service.ts).
  source?: TransactionSource;
  sourceRef?: string | null;
  updatedAt?: string;
};

export type TransactionSource = "manual" | "retailku_sync";

function isValidSourceFields(v: Record<string, unknown>): boolean {
  const sourceValid = v.source === undefined || v.source === "manual" || v.source === "retailku_sync";
  const sourceRefValid = v.sourceRef === undefined || v.sourceRef === null || typeof v.sourceRef === "string";
  // `sourceRef` tanpa `source` ambigu (ref milik sumber apa?) -- tolak.
  const pairValid = v.sourceRef === undefined || v.sourceRef === null || v.source !== undefined;
  return sourceValid && sourceRefValid && pairValid;
}

export function isPushTransactionPayload(value: unknown): value is PushTransactionPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const debtActionValid =
    v.debtAction === undefined ||
    v.debtAction === null ||
    v.debtAction === "settlement" ||
    v.debtAction === "payable";
  const settleDebtIdsValid =
    v.settleDebtIds === undefined ||
    (Array.isArray(v.settleDebtIds) && v.settleDebtIds.every((id) => typeof id === "string"));
  return (
    typeof v.id === "string" &&
    (v.type === "income" || v.type === "expense" || v.type === "transfer") &&
    typeof v.amount === "number" &&
    typeof v.note === "string" &&
    typeof v.date === "string" &&
    debtActionValid &&
    settleDebtIdsValid &&
    isValidSourceFields(v) &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Payload PATCH /transactions/:id -- SAMA bentuknya dgn
// PushTransactionPayload tapi TANPA `id` (dari path param, bukan body).
export type PatchTransactionPayload = Omit<PushTransactionPayload, "id">;

export function isPatchTransactionPayload(value: unknown): value is PatchTransactionPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const debtActionValid =
    v.debtAction === undefined ||
    v.debtAction === null ||
    v.debtAction === "settlement" ||
    v.debtAction === "payable";
  const settleDebtIdsValid =
    v.settleDebtIds === undefined ||
    (Array.isArray(v.settleDebtIds) && v.settleDebtIds.every((id) => typeof id === "string"));
  return (
    (v.type === "income" || v.type === "expense" || v.type === "transfer") &&
    typeof v.amount === "number" &&
    typeof v.note === "string" &&
    typeof v.date === "string" &&
    debtActionValid &&
    settleDebtIdsValid &&
    isValidSourceFields(v) &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}
