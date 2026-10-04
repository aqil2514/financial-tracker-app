import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { categoryFields } from "./create-category";

export function registerUpdateCategory(server: McpServer) {
  server.registerTool(
    "update_category",
    {
      title: "Ubah Kategori",
      description: "Ubah data kategori yang sudah ada berdasarkan ID.",
      inputSchema: z.object({ categoryId: z.string(), ...categoryFields }),
    },
    async ({ categoryId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/categories/${categoryId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
