import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, summarizeExpenseByCategory } from "@/lib/sync-snapshot";

export function registerGetExpenseSummaryByCategory(server: McpServer) {
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
}
