import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

// 1 tool generik lintas 3 junction table (transaction_labels/
// category_labels/account_labels) -- `scope` menentukan tabel mana yg
// disentuh di sisi Worker (lihat JUNCTION di
// apps/worker/src/modules/labels/service.ts), BUKAN 3 tool
// attach_transaction_label/attach_category_label/attach_account_label
// terpisah (keputusan desain, lihat general-label.md "Rencana endpoint").
export function registerAttachLabel(server: McpServer) {
  server.registerTool(
    "attach_label",
    {
      title: "Tempel Label",
      description:
        "Tempelkan label ke transaksi/kategori/akun. 'scope' menentukan jenis baris target, 'entityId' id baris itu sendiri, 'labelId' dari list_labels. Satu baris boleh punya lebih dari satu label sekaligus -- tidak ada validasi bentrok makna (mis. boleh 'Konsumtif' dan 'Produktif' bersamaan), itu tanggung jawab pengguna saat memilih.",
      inputSchema: z.object({
        scope: z.enum(["transactions", "categories", "accounts"]).describe("Jenis baris target"),
        entityId: z.string().min(1, "entityId wajib diisi").describe("ID transaksi/kategori/akun"),
        labelId: z.string().min(1, "labelId wajib diisi").describe("ID label, dari list_labels"),
      }),
    },
    async ({ scope, entityId, labelId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(
        token,
        `/labels/${encodeURIComponent(scope)}/${encodeURIComponent(entityId)}`,
        {
          method: "POST",
          body: JSON.stringify({ id: newId(), labelId }),
        }
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
