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

// `inputSchema` tool MCP cuma terima raw shape (ZodRawShapeCompat), BUKAN
// ZodObject/ZodEffects -- superRefine lintas-field (pola accountSchema
// desktop) tidak bisa dipasang di level skema di sini, jadi divalidasi
// manual di handler SEBELUM request ke Worker. Worker SENDIRI (upsertAccount)
// sengaja TIDAK menolak unitLabel kosong kalau field itu `undefined` --
// desktop push "accounts" dan "investment_accounts" sbg 2 request
// TERPISAH (lihat komentar di apps/worker/src/modules/accounts/service.ts),
// jadi Worker tidak bisa membedakan "desktop sengaja belum kirim" vs "MCP
// lupa isi". Validasi wajib utk caller yg SATU PAYLOAD lengkap (spt tool
// ini) jadi tanggung jawab MCP, bukan Worker.
function validateInvestmentAccountFields(args: {
  accountType: string;
  unitLabel?: string;
  currentMarketValue?: number;
}): string | null {
  if (args.accountType !== "investment") return null;
  if (!args.unitLabel?.trim()) {
    return "unitLabel wajib diisi untuk accountType='investment'.";
  }
  if (args.currentMarketValue == null || args.currentMarketValue < 0) {
    return "currentMarketValue wajib diisi (>= 0) untuk accountType='investment'.";
  }
  return null;
}

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
      const validationError = validateInvestmentAccountFields(args);
      if (validationError) {
        return { content: [{ type: "text", text: JSON.stringify({ error: validationError }, null, 2) }], isError: true };
      }

      const token = getToken(ctx);
      const result = await workerFetch(token, "/accounts", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}

export { validateInvestmentAccountFields };
