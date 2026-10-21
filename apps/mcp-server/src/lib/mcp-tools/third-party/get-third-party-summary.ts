import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, summarizeThirdParty } from "@/lib/sync-snapshot/entities";

// Pola PERSIS get_debt_summary -- breakdown "siapa titip berapa di mana"
// (per akun x kontak, HANYA pasangan yang sisanya != 0), port rumus
// apps/desktop/src/features/third-party/content/summary/use-third-party-summary.ts.
// TANPA status pending/settled (beda dari investasi) -- sisa SELALU
// dihitung ulang dari SUM baris third_party_funds.
export function registerGetThirdPartySummary(server: McpServer) {
  server.registerTool(
    "get_third_party_summary",
    {
      title: "Ringkasan Dana Pihak Ketiga",
      description:
        "Rangkuman titipan dana milik orang lain yang tersimpan di akun Anda, dipecah per akun x kontak -- cuma pasangan yang masih punya sisa titipan (!= 0). Opsional filter per akun atau kontak tertentu.",
      inputSchema: z.object({
        accountId: z.string().optional().describe("Filter berdasarkan akun dana pihak ketiga tertentu"),
        contactId: z.string().optional().describe("Filter berdasarkan kontak tertentu"),
      }),
    },
    async ({ accountId, contactId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = summarizeThirdParty(snapshot, { accountId, contactId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
