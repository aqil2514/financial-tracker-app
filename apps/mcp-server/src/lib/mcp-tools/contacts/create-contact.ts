import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerCreateContact(server: McpServer) {
  server.registerTool(
    "create_contact",
    {
      title: "Tambah Kontak",
      description: "Tambah kontak baru (nama orang/pihak untuk pencatatan utang-piutang atau transaksi).",
      inputSchema: z.object({
        name: z.string(),
        note: z.string().optional(),
      }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/contacts", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
