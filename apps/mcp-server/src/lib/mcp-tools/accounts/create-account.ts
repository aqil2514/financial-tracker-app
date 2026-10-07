import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { ACCOUNT_TYPES } from "@/lib/account-types";

export const accountFields = {
  name: z.string(),
  initialBalance: z.number(),
  accountType: z.enum(ACCOUNT_TYPES),
  groupId: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  unitLabel: z.string().optional().describe("Wajib diisi kalau accountType='investment' (mis. 'unit', 'lembar', 'gram')"),
  currentMarketValue: z
    .number()
    .optional()
    .describe("Wajib diisi kalau accountType='investment' -- nilai pasar TOTAL instrumen saat ini"),
};

export function registerCreateAccount(server: McpServer) {
  server.registerTool(
    "create_account",
    {
      title: "Tambah Akun",
      description:
        "Tambah akun baru (kas/bank, akun bertipe debt untuk tracking utang-piutang, atau akun bertipe investment -- wajib isi unitLabel & currentMarketValue untuk investment).",
      inputSchema: z.object(accountFields),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/accounts", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
