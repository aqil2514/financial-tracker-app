import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { accountFields } from "./create-account";

export function registerUpdateAccount(server: McpServer) {
  server.registerTool(
    "update_account",
    {
      title: "Ubah Akun",
      description: "Ubah data akun yang sudah ada berdasarkan ID.",
      inputSchema: z.object({ accountId: z.string(), ...accountFields }),
    },
    async ({ accountId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/accounts/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
