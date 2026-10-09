import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

// scope dibatasi 2 nilai -- 'transaction_category' dipakai BERSAMA oleh
// transaksi & kategori (saling fallback), 'account' khusus akun (jenis
// instrumen investasi dst). Lihat docs/todos/plan/general-label.md.
export function registerCreateLabel(server: McpServer) {
  server.registerTool(
    "create_label",
    {
      title: "Tambah Label Baru",
      description:
        "Tambah label baru ke dictionary -- label bisa ditempel ke transaksi/kategori (scope 'transaction_category', mis. 'Konsumtif'/'Produktif') atau akun (scope 'account', mis. jenis instrumen investasi 'RDPU'). Dicek dulu dengan list_labels sebelum membuat, hindari duplikat makna dengan nama berbeda.",
      inputSchema: z.object({
        name: z.string().min(1, "name wajib diisi"),
        scope: z.enum(["transaction_category", "account"]),
      }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/labels", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
