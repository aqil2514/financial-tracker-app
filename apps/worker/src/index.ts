export interface Env {
  DB: D1Database;
}

// Payload minimal dari PC utk push satu baris transaksi. SENGAJA belum
// ada autentikasi/validasi logic bisnis (FIFO debt, formula saldo, dst
// dari docs/todos/plan/mcp-server-business-logic-audit.md) -- endpoint
// ini DEVELOPMENT ONLY, cuma utk membuktikan jalur data PC->D1 hidup.
// JANGAN dipakai dari tool MCP tulis manapun sebelum validasi itu ada.
type PushTransactionPayload = {
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

function isPushTransactionPayload(value: unknown): value is PushTransactionPayload {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const { results } = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      ).all<{ name: string }>();
      return Response.json({ status: "ok", tables: results.map((row) => row.name) });
    }

    if (url.pathname === "/transactions" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!isPushTransactionPayload(body)) {
        return Response.json({ error: "Invalid payload" }, { status: 400 });
      }

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await env.DB.prepare(
        `INSERT INTO transactions
           (id, type, amount, category_id, account_id, transfer_account_id,
            note, date, description, contact_id, created_at, updated_at, sync_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pc')`
      )
        .bind(
          body.id,
          body.type,
          body.amount,
          body.categoryId ?? null,
          body.accountId ?? null,
          body.transferAccountId ?? null,
          body.note,
          body.date,
          body.description ?? null,
          body.contactId ?? null,
          now,
          now
        )
        .run();

      return Response.json({ status: "ok", id: body.id }, { status: 201 });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
