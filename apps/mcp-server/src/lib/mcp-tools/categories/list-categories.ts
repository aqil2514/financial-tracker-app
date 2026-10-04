import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listAliveCategories } from "@/lib/sync-snapshot";

export function registerListCategories(server: McpServer) {
  server.registerTool(
    "list_categories",
    {
      title: "Daftar Kategori",
      description: "Lihat semua kategori income/expense (atau filter berdasarkan type).",
      inputSchema: z.object({
        type: z.enum(["income", "expense"]).optional().describe("Filter tipe kategori, kosongkan untuk semua"),
      }),
    },
    async ({ type }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));

      const categories = listAliveCategories(snapshot).filter((c) => !type || c.type === type);

      const result = categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        parentId: c.parentId,
        isActive: c.isActive,
        updatedAt: c.updatedAt,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
