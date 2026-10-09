import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetchBinary } from "@/lib/worker-client";

// Gambar balas sbg ImageContent native (base64 + mimeType) supaya Claude
// benar-benar "melihat" isi struk/nota, bukan cuma terima metadata JSON.
// PDF TIDAK BISA pakai ContentBlock type "image" (bukan gambar) -- balas
// sbg EmbeddedResource (type "resource", BlobResourceContents) yg memang
// didesain generik utk file binary apa pun. GET /attachments/:id Worker
// balas raw bytes (BUKAN JSON), jadi pakai `workerFetchBinary` (bukan
// `workerFetch` yg selalu `.json()`).
export function registerGetAttachment(server: McpServer) {
  server.registerTool(
    "get_attachment",
    {
      title: "Lihat Lampiran Transaksi",
      description:
        "Ambil isi lampiran transaksi -- gambar (mis. utk dibaca/dianalisa isi struknya) atau PDF (mis. invoice) -- dapatkan 'id' dari list_attachments dulu. Gambar bisa langsung dilihat; PDF dikembalikan sbg resource (bukan dianalisis visual langsung).",
      inputSchema: z.object({
        id: z.string().min(1, "id wajib diisi").describe("ID attachment, dari list_attachments"),
      }),
    },
    async ({ id }, ctx) => {
      const token = getToken(ctx);
      const { bytes, contentType } = await workerFetchBinary(token, `/attachments/${encodeURIComponent(id)}`);
      const mimeType = contentType ?? "application/octet-stream";
      const base64 = Buffer.from(bytes).toString("base64");

      if (mimeType === "application/pdf") {
        return {
          content: [
            {
              type: "resource" as const,
              resource: {
                uri: `attachment://${id}`,
                mimeType,
                blob: base64,
              },
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "image" as const,
            data: base64,
            mimeType,
          },
        ],
      };
    }
  );
}
