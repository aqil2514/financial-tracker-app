import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyWorkerToken, workerFetch } from "@/lib/worker-client";
import {
  fetchFullSnapshot,
  computeAccountBalance,
  listAliveAccounts,
  summarizeExpenseByCategory,
  listTransactions,
  summarizeDebts,
  listContactHistory,
} from "@/lib/sync-snapshot";

function getToken(ctx: { http?: { authInfo?: AuthInfo } }): string {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("Missing auth token di konteks tool");
  return token;
}

const handler = createMcpHandler((server) => {
  server.registerTool(
    "get_account_balances",
    {
      title: "Saldo Akun",
      description: "Lihat saldo semua akun (atau satu akun tertentu kalau accountId diisi).",
      inputSchema: z.object({
        accountId: z.string().optional().describe("ID akun spesifik, kosongkan untuk semua akun"),
      }),
    },
    async ({ accountId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));

      const accounts = accountId
        ? listAliveAccounts(snapshot).filter((a) => a.id === accountId)
        : listAliveAccounts(snapshot);

      const result = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        accountType: a.accountType,
        balance: computeAccountBalance(snapshot, a.id),
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_expense_summary_by_category",
    {
      title: "Ringkasan Pengeluaran per Kategori",
      description: "Total pengeluaran dikelompokkan per kategori, opsional filter rentang tanggal.",
      inputSchema: z.object({
        from: z.string().optional().describe("Tanggal mulai, format YYYY-MM-DD"),
        to: z.string().optional().describe("Tanggal akhir, format YYYY-MM-DD"),
      }),
    },
    async ({ from, to }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = summarizeExpenseByCategory(snapshot, { from, to });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "list_transactions",
    {
      title: "Daftar Transaksi",
      description: "List transaksi terbaru, bisa difilter tanggal/tipe/akun.",
      inputSchema: z.object({
        limit: z.number().int().positive().max(100).optional().describe("Default 20, maksimal 100"),
        from: z.string().optional().describe("Tanggal mulai, format YYYY-MM-DD"),
        to: z.string().optional().describe("Tanggal akhir, format YYYY-MM-DD"),
        type: z.enum(["income", "expense", "transfer"]).optional(),
        accountId: z.string().optional(),
      }),
    },
    async ({ limit, from, to, type, accountId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = listTransactions(snapshot, { limit, from, to, type, accountId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_debt_summary",
    {
      title: "Ringkasan Utang Piutang",
      description: "Total piutang (receivable) dan utang (payable) yang masih berjalan.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = summarizeDebts(snapshot);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_contact_history",
    {
      title: "Riwayat per Kontak",
      description: "Lihat riwayat transaksi dan utang/piutang untuk satu kontak tertentu.",
      inputSchema: z.object({
        contactId: z.string().describe("ID kontak"),
      }),
    },
    async ({ contactId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = listContactHistory(snapshot, contactId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
});

const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const isValid = await verifyWorkerToken(bearerToken);
  if (!isValid) return undefined;

  return {
    token: bearerToken,
    scopes: ["read:finance"],
    clientId: "financial-app-mcp",
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["read:finance"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };
