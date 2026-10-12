import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot } from "@/lib/sync-snapshot/entities";

export function registerUpdateCategoryPeriod(server: McpServer) {
  server.registerTool(
    "update_category_period",
    {
      title: "Ubah Periode Kategori",
      description:
        "Ubah data Periode Kategori yang sudah ada berdasarkan ID. Field yang tidak diisi tetap memakai nilai lama. Mengisi categoryIds MENGGANTI SELURUH kategori terkait (bukan menambah), karena Worker menerapkannya sebagai replace-all.",
      inputSchema: z.object({
        periodId: z.string(),
        name: z.string().optional(),
        startDate: z.string().optional().describe("Format YYYY-MM-DD"),
        endDate: z.string().optional().describe("Format YYYY-MM-DD"),
        categoryIds: z.array(z.string()).min(1).optional().describe("Mengganti SELURUH kategori terkait kalau diisi"),
      }),
    },
    async ({ periodId, name, startDate, endDate, categoryIds }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const existing = snapshot.categoryPeriods.find((p) => p.id === periodId && p.deletedAt === null);
      if (!existing) {
        return { content: [{ type: "text", text: `Periode dengan id ${periodId} tidak ditemukan.` }] };
      }

      const result = await workerFetch(token, "/category-periods/push", {
        method: "POST",
        body: JSON.stringify({
          id: periodId,
          name: name ?? existing.name,
          startDate: startDate ?? existing.startDate,
          endDate: endDate ?? existing.endDate,
          categoryIds: (categoryIds ?? existing.categoryIds).map((categoryId) => ({ id: newId(), categoryId })),
        }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
