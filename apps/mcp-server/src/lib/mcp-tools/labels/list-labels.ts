import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

type LabelListItem = { id: string; name: string; scope: string; updatedAt: string | null; deletedAt: string | null };

export function registerListLabels(server: McpServer) {
  server.registerTool(
    "list_labels",
    {
      title: "Daftar Label",
      description:
        "Lihat daftar label yang ada di dictionary, opsional filter scope ('transaction_category' atau 'account'). Cek ini dulu sebelum attach_label atau create_label, supaya tidak membuat label duplikat dengan makna sama.",
      inputSchema: z.object({
        scope: z.enum(["transaction_category", "account"]).optional(),
      }),
    },
    async ({ scope }, ctx) => {
      const token = getToken(ctx);
      const query = scope ? `?scope=${encodeURIComponent(scope)}` : "";
      const result = await workerFetch<{ labels: LabelListItem[] }>(token, `/labels${query}`);
      return { content: [{ type: "text", text: JSON.stringify(result.labels, null, 2) }] };
    }
  );
}
