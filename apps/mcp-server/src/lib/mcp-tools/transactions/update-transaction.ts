import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { transactionFields } from "./create-transaction";

export function registerUpdateTransaction(server: McpServer) {
  server.registerTool(
    "update_transaction",
    {
      title: "Ubah Transaksi",
      description: "Ubah transaksi yang sudah ada berdasarkan ID.",
      inputSchema: z.object({ transactionId: z.string(), ...transactionFields }),
    },
    async ({ transactionId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/transactions/${transactionId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
