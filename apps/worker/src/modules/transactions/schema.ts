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
};

export function isPushTransactionPayload(value: unknown): value is PushTransactionPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    (v.type === "income" || v.type === "expense" || v.type === "transfer") &&
    typeof v.amount === "number" &&
    typeof v.note === "string" &&
    typeof v.date === "string"
  );
}
