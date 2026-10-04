import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, computeAccountBalance, listAliveAccounts } from "@/lib/sync-snapshot";

export function registerGetAccountBalances(server: McpServer) {
  server.registerTool(
    "get_account_balances",
    {
      title: "Saldo Akun",
      description: "Lihat saldo semua akun (atau satu akun tertentu kalau accountId diisi).",
      inputSchema: z.object({
        accountId: z.string().optional().describe("ID akun spesifik, kosongkan untuk semua akun"),
      }),
    },
    async ({ accountId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));

      const accounts = accountId
        ? listAliveAccounts(snapshot).filter((a) => a.id === accountId)
        : listAliveAccounts(snapshot);

      const groupNameById = new Map(
        snapshot.accountGroups.filter((g) => g.deletedAt === null).map((g) => [g.id, g.name])
      );

      const result = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        accountType: a.accountType,
        isActive: a.isActive,
        groupName: a.groupId ? (groupNameById.get(a.groupId) ?? null) : null,
        description: a.description,
        balance: computeAccountBalance(snapshot, a.id),
        updatedAt: a.updatedAt,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
