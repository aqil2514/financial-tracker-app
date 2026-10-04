import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDeleteAccount(server: McpServer) {
  server.registerTool(
    "delete_account",
    {
      title: "Hapus Akun",
      description:
        "Hapus akun berdasarkan ID. Wajib confirm:true. Kalau akun masih punya transaksi terkait, isi transactionAction ('unassign' atau 'reassign' dengan targetAccountId) -- kalau tidak diisi dan masih ada transaksi terkait, transaksi tetap merujuk akun yang sudah terhapus.",
      inputSchema: z.object({
        accountId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
        transactionAction: z.enum(["unassign", "reassign"]).optional(),
        targetAccountId: z.string().optional().describe("Wajib diisi kalau transactionAction=reassign"),
      }),
    },
    async ({ accountId, confirm: _confirm, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/accounts/${accountId}`, {
        method: "DELETE",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
