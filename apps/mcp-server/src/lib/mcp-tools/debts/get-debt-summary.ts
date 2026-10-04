import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, summarizeDebts } from "@/lib/sync-snapshot";

export function registerGetDebtSummary(server: McpServer) {
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
}
