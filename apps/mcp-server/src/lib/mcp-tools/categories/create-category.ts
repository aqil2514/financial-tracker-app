import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export const categoryFields = {
  name: z.string(),
  type: z.enum(["income", "expense"]),
  icon: z.string().optional(),
  parentId: z.string().optional(),
  isActive: z.boolean().optional(),
};

export function registerCreateCategory(server: McpServer) {
  server.registerTool(
    "create_category",
    {
      title: "Tambah Kategori",
      description: "Tambah kategori baru untuk income atau expense.",
      inputSchema: z.object(categoryFields),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/categories", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
