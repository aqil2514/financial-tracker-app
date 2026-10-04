import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDeleteContact(server: McpServer) {
  server.registerTool(
    "delete_contact",
    {
      title: "Hapus Kontak",
      description:
        "Hapus kontak berdasarkan ID. Wajib confirm:true -- transaksi yang masih merujuk kontak ini akan kehilangan kaitannya (contact_id jadi kosong), bukan ikut terhapus.",
      inputSchema: z.object({
        contactId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
      }),
    },
    async ({ contactId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/contacts/${contactId}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
