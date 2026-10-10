import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listTransactions, buildNameLookups } from "@/lib/sync-snapshot";

export function registerListTransactions(server: McpServer) {
  server.registerTool(
    "list_transactions",
    {
      title: "Daftar Transaksi",
      description:
        "List transaksi terbaru, bisa difilter tanggal/tipe/akun/kategori/kontak/kata kunci/rentang nominal.",
      inputSchema: z.object({
        limit: z.number().int().positive().max(100).optional().describe("Default 20, maksimal 100"),
        from: z.string().optional().describe("Tanggal mulai, format YYYY-MM-DD"),
        to: z.string().optional().describe("Tanggal akhir, format YYYY-MM-DD"),
        type: z.enum(["income", "expense", "transfer"]).optional(),
        accountId: z.string().optional().describe("Cocok kalau jadi akun sumber ATAU akun tujuan (transfer)"),
        transferDirection: z
          .enum(["from", "to"])
          .optional()
          .describe(
            "Persempit accountId jadi SATU sisi transfer saja -- 'from' = accountId wajib akun sumber, 'to' = wajib akun tujuan. Tanpa ini accountId cocok di kedua sisi."
          ),
        categoryId: z.string().optional(),
        contactId: z.string().optional(),
        query: z.string().optional().describe("Cari substring (case-insensitive) di note/description"),
        minAmount: z.number().nonnegative().optional(),
        maxAmount: z.number().nonnegative().optional(),
      }),
    },
    async ({ limit, from, to, type, accountId, transferDirection, categoryId, contactId, query, minAmount, maxAmount }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const transactions = listTransactions(snapshot, {
        limit,
        from,
        to,
        type,
        accountId,
        transferDirection,
        categoryId,
        contactId,
        query,
        minAmount,
        maxAmount,
      });
      const lookup = buildNameLookups(snapshot);

      const result = transactions.map((t) => ({
        ...t,
        categoryName: t.categoryId ? (lookup.categoryName.get(t.categoryId) ?? null) : null,
        accountName: t.accountId ? (lookup.accountName.get(t.accountId) ?? null) : null,
        transferAccountName: t.transferAccountId ? (lookup.accountName.get(t.transferAccountId) ?? null) : null,
        contactName: t.contactId ? (lookup.contactName.get(t.contactId) ?? null) : null,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
