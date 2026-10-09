import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDeleteLabel(server: McpServer) {
  server.registerTool(
    "delete_label",
    {
      title: "Hapus Label",
      description:
        "Hapus label dari dictionary berdasarkan ID -- dapatkan 'id' dari list_labels dulu. Baris transaksi/kategori/akun yang masih menempel label ini TIDAK ikut berubah datanya, tapi label itu tidak lagi muncul sebagai label aktif di baris manapun. Wajib confirm:true.",
      inputSchema: z.object({
        id: z.string().min(1, "id wajib diisi").describe("ID label, dari list_labels"),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
      }),
    },
    async ({ id }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/labels/${encodeURIComponent(id)}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
