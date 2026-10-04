import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerDeleteAccountGroup(server: McpServer) {
  server.registerTool(
    "delete_account_group",
    {
      title: "Hapus Grup Akun",
      description:
        "Hapus grup akun berdasarkan ID. Wajib confirm:true. Kalau grup masih punya anggota akun, isi memberAction ('unassign' atau 'reassign' dengan targetGroupId) -- kalau tidak diisi, akun anggota tetap merujuk grup yang sudah terhapus.",
      inputSchema: z.object({
        accountGroupId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
        memberAction: z.enum(["unassign", "reassign"]).optional(),
        targetGroupId: z.string().optional().describe("Wajib diisi kalau memberAction=reassign"),
      }),
    },
    async ({ accountGroupId, confirm: _confirm, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/account-groups/${accountGroupId}`, {
        method: "DELETE",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
