import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDeleteCategory(server: McpServer) {
  server.registerTool(
    "delete_category",
    {
      title: "Hapus Kategori",
      description:
        "Hapus kategori berdasarkan ID. Wajib confirm:true. Kalau kategori masih punya sub-kategori atau transaksi terkait, isi childAction/targetParentId dan transactionAction/targetCategoryId sesuai kebutuhan -- kalau tidak diisi, relasi tetap merujuk kategori yang sudah terhapus.",
      inputSchema: z.object({
        categoryId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
        childAction: z.enum(["unassign", "reassign"]).optional(),
        targetParentId: z.string().optional().describe("Wajib diisi kalau childAction=reassign"),
        transactionAction: z.enum(["unassign", "reassign"]).optional(),
        targetCategoryId: z.string().optional().describe("Wajib diisi kalau transactionAction=reassign"),
      }),
    },
    async ({ categoryId, confirm: _confirm, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/categories/${categoryId}`, {
        method: "DELETE",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
