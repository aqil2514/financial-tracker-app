import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDeleteAttachment(server: McpServer) {
  server.registerTool(
    "delete_attachment",
    {
      title: "Hapus Lampiran Foto",
      description:
        "Hapus lampiran foto transaksi berdasarkan ID -- dapatkan 'id' dari list_attachments dulu. Wajib confirm:true -- aksi ini tidak bisa dibatalkan dari sisi Claude, pastikan sudah konfirmasi ke pengguna sebelum memanggil.",
      inputSchema: z.object({
        id: z.string().min(1, "id wajib diisi").describe("ID attachment, dari list_attachments"),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
      }),
    },
    async ({ id }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/attachments/${encodeURIComponent(id)}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
