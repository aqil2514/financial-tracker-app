import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerUpdateContact(server: McpServer) {
  server.registerTool(
    "update_contact",
    {
      title: "Ubah Kontak",
      description: "Ubah nama/catatan kontak yang sudah ada berdasarkan ID.",
      inputSchema: z.object({
        contactId: z.string(),
        name: z.string(),
        note: z.string().optional(),
      }),
    },
    async ({ contactId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
