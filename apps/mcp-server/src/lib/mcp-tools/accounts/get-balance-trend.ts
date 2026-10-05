import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, computeBalanceTrend } from "@/lib/sync-snapshot";
import { ACCOUNT_TYPES } from "@/lib/account-types";

export function registerGetBalanceTrend(server: McpServer) {
  server.registerTool(
    "get_balance_trend",
    {
      title: "Tren Saldo",
      description:
        "Tren saldo akun dari waktu ke waktu (deret titik waktu), dihitung di tiap titik granularitas dalam rentang tanggal. Filter tipe akun/grup akun/akun individual opsional dan independen (AND) -- defaultnya seluruh akun aktif.",
      inputSchema: z.object({
        from: z.string().describe("Tanggal mulai, format YYYY-MM-DD"),
        to: z.string().describe("Tanggal akhir, format YYYY-MM-DD"),
        granularity: z
          .enum(["day", "week", "month", "year"])
          .default("day")
          .describe("Granularitas titik data"),
        accountTypes: z
          .array(z.enum(ACCOUNT_TYPES))
          .optional()
          .describe("Filter tipe akun, kosongkan untuk semua tipe"),
        groupIds: z.array(z.string()).optional().describe("Filter ID grup akun, kosongkan untuk semua grup"),
        accountIds: z
          .array(z.string())
          .optional()
          .describe("Filter ID akun individual (termasuk akun nonaktif kalau diisi eksplisit), kosongkan untuk semua akun aktif"),
      }),
    },
    async ({ from, to, granularity, accountTypes, groupIds, accountIds }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = computeBalanceTrend(snapshot, from, to, granularity, {
        accountTypes,
        groupIds,
        accountIds,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
