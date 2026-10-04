import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDeleteTransaction(server: McpServer) {
  server.registerTool(
    "delete_transaction",
    {
      title: "Hapus Transaksi",
      description:
        "Hapus transaksi berdasarkan ID. Wajib confirm:true -- aksi ini tidak bisa dibatalkan dari sisi Claude, pastikan sudah konfirmasi ke pengguna sebelum memanggil.",
      inputSchema: z.object({
        transactionId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
      }),
    },
    async ({ transactionId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/transactions/${transactionId}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
