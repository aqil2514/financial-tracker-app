import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listContactHistory } from "@/lib/sync-snapshot";

export function registerGetContactHistory(server: McpServer) {
  server.registerTool(
    "get_contact_history",
    {
      title: "Riwayat per Kontak",
      description: "Lihat riwayat transaksi dan utang/piutang untuk satu kontak tertentu.",
      inputSchema: z.object({
        contactId: z.string().describe("ID kontak"),
      }),
    },
    async ({ contactId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = listContactHistory(snapshot, contactId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
