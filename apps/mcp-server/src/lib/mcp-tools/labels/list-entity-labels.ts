import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

type EntityLabelItem = { labelId: string; name: string; scope: string };

export function registerListEntityLabels(server: McpServer) {
  server.registerTool(
    "list_entity_labels",
    {
      title: "Daftar Label di Satu Baris",
      description:
        "Lihat label apa saja yang nempel di satu transaksi/kategori/akun tertentu. 'scope' menentukan jenis baris, 'entityId' id baris itu.",
      inputSchema: z.object({
        scope: z.enum(["transactions", "categories", "accounts"]).describe("Jenis baris target"),
        entityId: z.string().min(1, "entityId wajib diisi").describe("ID transaksi/kategori/akun"),
      }),
    },
    async ({ scope, entityId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch<{ labels: EntityLabelItem[] }>(
        token,
        `/labels/${encodeURIComponent(scope)}/${encodeURIComponent(entityId)}`
      );
      return { content: [{ type: "text", text: JSON.stringify(result.labels, null, 2) }] };
    }
  );
}
