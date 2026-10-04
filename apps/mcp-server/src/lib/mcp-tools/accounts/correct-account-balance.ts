import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

export function registerCorrectAccountBalance(server: McpServer) {
  server.registerTool(
    "correct_account_balance",
    {
      title: "Koreksi Saldo Akun",
      description:
        "Sesuaikan saldo akun ke nominal target tertentu. Worker otomatis membuat transaksi penyesuaian (income/expense) dengan kategori 'Penyesuaian Saldo' untuk menutup selisihnya.",
      inputSchema: z.object({
        accountId: z.string(),
        targetBalance: z.number().describe("Saldo akhir yang diinginkan setelah koreksi"),
      }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/accounts/correct-balance", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
