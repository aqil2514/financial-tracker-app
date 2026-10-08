import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetchBinary } from "@/lib/worker-client";

// SATU-SATUNYA tool di proyek ini yang balas ImageContent (bukan cuma
// `type: "text"`) -- MCP ContentBlock mendukung gambar native (base64 +
// mimeType), dipakai di sini supaya Claude benar-benar "melihat" isi
// struk/nota, bukan cuma terima metadata JSON. GET /attachments/:id
// Worker balas raw bytes (BUKAN JSON), jadi pakai `workerFetchBinary`
// (bukan `workerFetch` yg selalu `.json()`).
export function registerGetAttachment(server: McpServer) {
  server.registerTool(
    "get_attachment",
    {
      title: "Lihat Lampiran Foto",
      description:
        "Ambil isi gambar lampiran transaksi (mis. utk dibaca/dianalisa isi struknya) -- dapatkan 'id' dari list_attachments dulu. Hasilnya gambar yang bisa langsung dilihat, bukan cuma metadata.",
      inputSchema: z.object({
        id: z.string().min(1, "id wajib diisi").describe("ID attachment, dari list_attachments"),
      }),
    },
    async ({ id }, ctx) => {
      const token = getToken(ctx);
      const { bytes, contentType } = await workerFetchBinary(token, `/attachments/${encodeURIComponent(id)}`);

      return {
        content: [
          {
            type: "image" as const,
            data: Buffer.from(bytes).toString("base64"),
            mimeType: contentType ?? "application/octet-stream",
          },
        ],
      };
    }
  );
}
