// Payload minimal dari PC utk push satu baris transaksi. SENGAJA belum
// ada validasi logic bisnis (FIFO debt, formula saldo, dst dari
// docs/todos/plan/mcp-server-business-logic-audit.md) -- endpoint ini
// DEVELOPMENT ONLY, cuma utk membuktikan jalur data PC->D1 hidup.
// JANGAN dipakai dari tool MCP tulis manapun sebelum validasi itu ada.
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
};

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
    settleDebtIdsValid
  );
}
