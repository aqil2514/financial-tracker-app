import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listCategoryPeriods } from "@/lib/sync-snapshot/entities";

export function registerListCategoryPeriods(server: McpServer) {
  server.registerTool(
    "list_category_periods",
    {
      title: "Daftar Periode Kategori",
      description:
        "Lihat semua Periode Kategori (jendela waktu custom bernama, mis. 'Panen 2025'), opsional filter nama dan/atau kategori yang tercakup.",
      inputSchema: z.object({
        name: z.string().optional().describe("Filter substring nama periode, case-insensitive"),
        categoryId: z.string().optional().describe("Filter periode yang mencakup kategori ini"),
      }),
    },
    async ({ name, categoryId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const periods = listCategoryPeriods(snapshot, { name, categoryId });
      return { content: [{ type: "text", text: JSON.stringify(periods, null, 2) }] };
    }
  );
}
