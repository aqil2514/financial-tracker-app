import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

// Mapping endpoint POST /investments/sales/:id/settle (Worker) -- dana
// hasil jual yang masih 'pending' baru benar-benar "cair" di titik ini:
// Worker insert leg transfer (investment->cash, average cost x unit)
// + leg penyesuaian Realized P/L, isi average_cost_per_unit/realized_pl
// permanen, baris investment_sales jadi 'settled'. Pola sama tombol
// "Settle" di SalesHistoryTable desktop (settle-sale-form/) -- akun kas
// tujuan WAJIB dipilih di sini krn baris pending tidak menyimpannya.
export function registerSettleInvestmentSale(server: McpServer) {
  server.registerTool(
    "settle_investment_sale",
    {
      title: "Settle Penjualan Investasi",
      description:
        "Settle satu baris penjualan investasi (investment_sales) yang masih 'pending' -- cairkan dana hasil jual ke akun kas tujuan. Average cost & Realized P/L dihitung SAAT INI (bukan saat baris dibuat) dan disimpan permanen. Pakai saleId dari get_investment_detail.",
      inputSchema: z.object({
        saleId: z.string().min(1, "saleId wajib diisi").describe("ID baris investment_sales yang masih pending"),
        transferAccountId: z.string().min(1, "transferAccountId wajib diisi").describe("Akun kas tujuan dana hasil jual"),
      }),
    },
    async ({ saleId, transferAccountId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/investments/sales/${saleId}/settle`, {
        method: "POST",
        body: JSON.stringify({ transferAccountId }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
