import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

type AttachmentListItem = {
  id: string;
  transactionId: string;
  contentType: string | null;
  sizeBytes: number | null;
  updatedAt: string | null;
  deletedAt: string | null;
};
type AttachmentListResponse = { checkpoint: string; attachments: AttachmentListItem[] };

// Filter `transactionId` (query param TAMBAHAN di Worker, bukan bagian
// desain awal `GET /attachments?since=` yg dibuat utk kebutuhan sync PC
// -- lihat apps/worker/src/modules/attachments/service.ts) krn tool ini
// butuh "lampiran transaksi X", bukan "semua yg berubah sejak kapan".
export function registerListAttachments(server: McpServer) {
  server.registerTool(
    "list_attachments",
    {
      title: "Daftar Lampiran Transaksi",
      description:
        "Lihat daftar lampiran foto suatu transaksi (metadata saja -- id, ukuran, tipe). Pakai 'id' hasilnya dengan get_attachment untuk melihat isi gambarnya.",
      inputSchema: z.object({
        transactionId: z.string().min(1, "transactionId wajib diisi"),
      }),
    },
    async ({ transactionId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch<AttachmentListResponse>(
        token,
        `/attachments?transactionId=${encodeURIComponent(transactionId)}`
      );
      // Row soft-deleted TIDAK relevan utk Claude (sudah tidak ada
      // filenya di R2) -- disaring di sini drpd Worker, krn endpoint yg
      // sama dipakai desktop utk pull (yg JUSTRU butuh tau baris mana
      // yg deleted, lihat pull-attachments.ts).
      const active = result.attachments.filter((a) => a.deletedAt === null);
      return { content: [{ type: "text", text: JSON.stringify(active, null, 2) }] };
    }
  );
}
