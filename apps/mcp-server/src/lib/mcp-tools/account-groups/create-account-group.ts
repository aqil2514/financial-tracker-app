import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerCreateAccountGroup(server: McpServer) {
  server.registerTool(
    "create_account_group",
    {
      title: "Tambah Grup Akun",
      description: "Tambah grup akun baru untuk mengelompokkan beberapa akun.",
      inputSchema: z.object({ name: z.string() }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/account-groups", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
