import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listInvestmentDetail, getInvestmentHolding } from "@/lib/sync-snapshot";

// Pola sama get_debt_detail -- riwayat lot (pembelian + penjualan) SATU
// akun investment, termasuk transactionId tiap baris (dipakai
// update_transaction/delete_transaction kalau mau ubah/hapus satu lot
// tertentu, sama alasan dgn transactionId di get_debt_detail). Beda dari
// get_investment_summary (lintas semua akun, agregat saja) -- tool ini
// drill-down satu akun, pola sama halaman /investments/detail desktop.
export function registerGetInvestmentDetail(server: McpServer) {
  server.registerTool(
    "get_investment_detail",
    {
      title: "Detail Investasi + Riwayat Lot",
      description:
        "Lihat detail satu akun investasi: holding saat ini (nilai pasar, Unrealized P/L, average cost, sisa unit) beserta riwayat lengkap pembelian (investment_purchases) dan penjualan (investment_sales), termasuk transactionId tiap baris. Pakai saleId dari sini untuk settle_investment_sale/delete_pending_investment_sale, atau transactionId untuk update_transaction/delete_transaction.",
      inputSchema: z.object({
        accountId: z.string().min(1, "accountId wajib diisi").describe("Akun bertipe 'investment'"),
      }),
    },
    async ({ accountId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const holding = getInvestmentHolding(snapshot, accountId);
      const { purchases, sales } = listInvestmentDetail(snapshot, accountId);

      const result = { accountId, holding, purchases, sales };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
