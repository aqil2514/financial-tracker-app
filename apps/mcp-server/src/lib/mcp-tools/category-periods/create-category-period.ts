import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export const categoryPeriodFields = {
  name: z.string(),
  startDate: z.string().describe("Format YYYY-MM-DD"),
  endDate: z.string().describe("Format YYYY-MM-DD"),
  categoryIds: z.array(z.string()).min(1).describe("Kategori yang tercakup dalam periode ini, minimal 1"),
};

export function registerCreateCategoryPeriod(server: McpServer) {
  server.registerTool(
    "create_category_period",
    {
      title: "Tambah Periode Kategori",
      description:
        "Tambah Periode Kategori baru (jendela waktu custom bernama, mis. 'Panen 2025') yang mencakup satu atau lebih kategori sekaligus.",
      inputSchema: z.object(categoryPeriodFields),
    },
    async ({ categoryIds, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/category-periods/push", {
        method: "POST",
        body: JSON.stringify({
          id: newId(),
          ...rest,
          categoryIds: categoryIds.map((categoryId) => ({ id: newId(), categoryId })),
        }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
