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
  // Wajib (lihat isValidAccountFields) -- akun adalah tumpuan semua data,
  // docs/concept/konsep-tipe-akun.md. transferAccountId wajib tambahan
  // kalau type='transfer'.
  accountId: string;
  transferAccountId?: string | null;
  description?: string | null;
  contactId?: string | null;
  // Alternatif contactId -- nama kontak dalam bahasa natural (dipakai
  // tool MCP yg terima nama dari Claude, bukan ID siap pakai). HANYA
  // dipakai kalau contactId kosong -- contactId eksplisit SELALU menang
  // (lihat resolveContactId call-site di service.ts). Resolve terjadi di
  // Worker (get-or-create by name case-insensitive), BUKAN di mcp-server.
  contactName?: string;
  // Hanya relevan saat type='transfer' DAN arah debt->cash (ambigu
  // antara pelunasan piutang existing vs utang baru) -- lihat logic
  // #1 di mcp-server-business-logic-audit.md, port dari
  // apply-debt-transaction.ts (ApplyDebtTransactionInput).
  debtAction?: "settlement" | "payable" | null;
  // debts.id yang dipilih utk dilunasi, cuma dipakai saat
  // debtAction === 'settlement'.
  settleDebtIds?: string[];
  // Hanya relevan saat type='transfer' DAN arah cash->investment (lahir
  // baris investment_purchases) ATAU investment->cash (lahir baris
  // investment_sales, BELUM diport ke Worker -- lihat
  // docs/todos/plan/investment-sync.md Tahap 2). Opsional/nullable sama
  // alasan dgn investment_purchases.unit/price_per_unit di desktop (order
  // pending yg belum tahu nilai pasti).
  unit?: number | null;
  pricePerUnit?: number | null;
  investmentStatus?: "pending" | "settled";
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

// Akun adalah tumpuan semua data (docs/concept/konsep-tipe-akun.md) --
// accountId WAJIB utk semua type, transferAccountId WAJIB tambahan utk
// type='transfer'. Sebelumnya accountId opsional di sini (beda dari form
// desktop yg selalu mewajibkan) -- celah yg memungkinkan transaksi
// income/expense tercatat tanpa akun lewat MCP/push PC, lihat
// audit-kepatuhan-konsep-tipe-akun.md pertanyaan #3.
function isValidAccountFields(v: Record<string, unknown>): boolean {
  if (typeof v.accountId !== "string" || v.accountId.length === 0) return false;
  if (v.type === "transfer") {
    return typeof v.transferAccountId === "string" && v.transferAccountId.length > 0;
  }
  return true;
}

// Dipakai isPushTransactionPayload & isPatchTransactionPayload -- bentuk
// field investment sama persis di keduanya (unit/pricePerUnit nullable,
// investmentStatus opsional), lihat komentar PushTransactionPayload.
function isValidInvestmentFields(v: Record<string, unknown>): boolean {
  return (
    (v.unit === undefined || v.unit === null || typeof v.unit === "number") &&
    (v.pricePerUnit === undefined || v.pricePerUnit === null || typeof v.pricePerUnit === "number") &&
    (v.investmentStatus === undefined || v.investmentStatus === "pending" || v.investmentStatus === "settled")
  );
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
  const contactNameValid = v.contactName === undefined || typeof v.contactName === "string";
  return (
    typeof v.id === "string" &&
    (v.type === "income" || v.type === "expense" || v.type === "transfer") &&
    typeof v.amount === "number" &&
    typeof v.note === "string" &&
    typeof v.date === "string" &&
    isValidAccountFields(v) &&
    debtActionValid &&
    settleDebtIdsValid &&
    contactNameValid &&
    isValidInvestmentFields(v) &&
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
  const contactNameValid = v.contactName === undefined || typeof v.contactName === "string";
  return (
    (v.type === "income" || v.type === "expense" || v.type === "transfer") &&
    typeof v.amount === "number" &&
    typeof v.note === "string" &&
    typeof v.date === "string" &&
    isValidAccountFields(v) &&
    debtActionValid &&
    settleDebtIdsValid &&
    contactNameValid &&
    isValidInvestmentFields(v) &&
    isValidSourceFields(v) &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}
