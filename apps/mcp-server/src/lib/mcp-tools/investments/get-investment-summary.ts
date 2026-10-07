import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, summarizeInvestments } from "@/lib/sync-snapshot";

// Menutup gap docs/todos/plan/investment-sync.md Tahap 4 -- pola sama
// get_debt_summary. Ringkasan LINTAS semua akun investment (Unrealized
// P/L per akun + total, Realized P/L kumulatif dari seluruh penjualan
// settled). Detail per-lot (riwayat pembelian/penjualan satu akun) ada
// di get_investment_detail, terpisah supaya tool ini tetap ringkas.
export function registerGetInvestmentSummary(server: McpServer) {
  server.registerTool(
    "get_investment_summary",
    {
      title: "Ringkasan Investasi",
      description:
        "Ringkasan semua akun investasi: nilai pasar, Unrealized P/L (nominal & persen posisi aktif), average cost, sisa unit yang bisa dijual per akun, plus total Unrealized P/L dan Realized P/L kumulatif (dari seluruh penjualan yang sudah settled).",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = summarizeInvestments(snapshot);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
