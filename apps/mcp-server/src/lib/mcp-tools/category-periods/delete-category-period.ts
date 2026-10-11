import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDeleteCategoryPeriod(server: McpServer) {
  server.registerTool(
    "delete_category_period",
    {
      title: "Hapus Periode Kategori",
      description: "Hapus Periode Kategori berdasarkan ID. Wajib confirm:true.",
      inputSchema: z.object({
        periodId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
      }),
    },
    async ({ periodId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/category-periods/push/${periodId}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
