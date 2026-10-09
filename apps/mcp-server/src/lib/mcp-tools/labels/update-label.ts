import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

// Rename saja -- scope TIDAK bisa diubah lewat tool ini (Worker tolak
// kalau scope beda dari existing, lihat upsertLabel di
// apps/worker/src/modules/labels/service.ts). `scope` tetap wajib dikirim
// krn endpoint PATCH Worker-nya upsert generik yg butuh payload lengkap.
export function registerUpdateLabel(server: McpServer) {
  server.registerTool(
    "update_label",
    {
      title: "Ubah Nama Label",
      description:
        "Ubah nama label yang sudah ada -- dapatkan 'id' dan 'scope' dari list_labels dulu. Scope tidak bisa diubah lewat tool ini (kirim scope yang sama dengan label aslinya).",
      inputSchema: z.object({
        id: z.string().min(1, "id wajib diisi").describe("ID label, dari list_labels"),
        name: z.string().min(1, "name wajib diisi"),
        scope: z.enum(["transaction_category", "account"]).describe("Harus sama dengan scope label aslinya"),
      }),
    },
    async ({ id, name, scope }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/labels/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name, scope }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
