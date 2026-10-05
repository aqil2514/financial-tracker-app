import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, summarizeCashflow } from "@/lib/sync-snapshot";

export function registerGetCashflowBreakdown(server: McpServer) {
  server.registerTool(
    "get_cashflow_breakdown",
    {
      title: "Breakdown Cashflow",
      description:
        "Breakdown kas masuk (pemasukan) dan kas keluar (pengeluaran) per grup akun untuk rentang tanggal tertentu. Transfer antar akun tidak dihitung.",
      inputSchema: z.object({
        from: z.string().optional().describe("Tanggal mulai, format YYYY-MM-DD"),
        to: z.string().optional().describe("Tanggal akhir, format YYYY-MM-DD"),
      }),
    },
    async ({ from, to }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = summarizeCashflow(snapshot, { from, to });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
