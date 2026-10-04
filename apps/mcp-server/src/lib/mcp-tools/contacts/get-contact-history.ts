import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listContactHistory, buildNameLookups } from "@/lib/sync-snapshot";

export function registerGetContactHistory(server: McpServer) {
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
      const history = listContactHistory(snapshot, contactId);
      const lookup = buildNameLookups(snapshot);

      const result = {
        transactions: history.transactions.map((t) => ({
          ...t,
          categoryName: t.categoryId ? (lookup.categoryName.get(t.categoryId) ?? null) : null,
          accountName: t.accountId ? (lookup.accountName.get(t.accountId) ?? null) : null,
          transferAccountName: t.transferAccountId ? (lookup.accountName.get(t.transferAccountId) ?? null) : null,
        })),
        debts: history.debts.map((d) => ({
          ...d,
          accountName: d.accountId ? (lookup.accountName.get(d.accountId) ?? null) : null,
          payments: d.payments.map((p) => ({
            ...p,
            accountName: p.accountId ? (lookup.accountName.get(p.accountId) ?? null) : null,
          })),
        })),
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
