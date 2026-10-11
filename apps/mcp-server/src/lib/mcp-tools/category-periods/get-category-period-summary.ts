import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, getCategoryPeriodSummary } from "@/lib/sync-snapshot";

export function registerGetCategoryPeriodSummary(server: McpServer) {
  server.registerTool(
    "get_category_period_summary",
    {
      title: "Ringkasan Periode Kategori",
      description:
        "Ringkasan total pemasukan/pengeluaran + daftar transaksi untuk satu Periode Kategori, berdasarkan ID.",
      inputSchema: z.object({ periodId: z.string() }),
    },
    async ({ periodId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const summary = getCategoryPeriodSummary(snapshot, periodId);
      if (!summary) {
        return { content: [{ type: "text", text: `Periode dengan id ${periodId} tidak ditemukan.` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );
}
