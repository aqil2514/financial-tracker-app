import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listTransactions } from "@/lib/sync-snapshot";

export function registerListTransactions(server: McpServer) {
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
}
