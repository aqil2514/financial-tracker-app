import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerUpdateAccountGroup(server: McpServer) {
  server.registerTool(
    "update_account_group",
    {
      title: "Ubah Grup Akun",
      description: "Ubah nama grup akun yang sudah ada berdasarkan ID.",
      inputSchema: z.object({ accountGroupId: z.string(), name: z.string() }),
    },
    async ({ accountGroupId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/account-groups/${accountGroupId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
