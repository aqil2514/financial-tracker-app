import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDetachLabel(server: McpServer) {
  server.registerTool(
    "detach_label",
    {
      title: "Lepas Label",
      description:
        "Lepas label dari transaksi/kategori/akun -- dapatkan 'labelId' yang nempel dari list_entity_labels dulu. 'scope' + 'entityId' menentukan baris target yang sama seperti attach_label.",
      inputSchema: z.object({
        scope: z.enum(["transactions", "categories", "accounts"]).describe("Jenis baris target"),
        entityId: z.string().min(1, "entityId wajib diisi").describe("ID transaksi/kategori/akun"),
        labelId: z.string().min(1, "labelId wajib diisi").describe("ID label yang nempel, dari list_entity_labels"),
      }),
    },
    async ({ scope, entityId, labelId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(
        token,
        `/labels/${encodeURIComponent(scope)}/${encodeURIComponent(entityId)}/${encodeURIComponent(labelId)}`,
        { method: "DELETE" }
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
