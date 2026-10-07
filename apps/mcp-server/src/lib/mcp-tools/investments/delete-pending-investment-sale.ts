import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

// Mapping endpoint DELETE /investments/sales/:id (Worker) -- BUKAN lewat
// delete_transaction krn baris 'pending' TIDAK punya transaksi apa pun
// (lihat applySellInvestmentTransaction: pending cuma insert baris
// investment_sales, tidak ada transactions sama sekali). Pola sama
// tombol "Hapus" di SalesHistoryTable desktop
// (use-delete-pending-investment-sale.ts). Ditolak 422 kalau baris sudah
// 'settled' -- itu cuma bisa dihapus lewat delete_transaction transaksi
// utamanya.
export function registerDeletePendingInvestmentSale(server: McpServer) {
  server.registerTool(
    "delete_pending_investment_sale",
    {
      title: "Hapus Penjualan Investasi (Pending)",
      description:
        "Hapus satu baris penjualan investasi (investment_sales) yang MASIH berstatus 'pending' -- membatalkan order jual sebelum settlement dikonfirmasi. Ditolak kalau baris sudah 'settled' (gunakan delete_transaction transaksi utamanya untuk itu). Wajib confirm:true.",
      inputSchema: z.object({
        saleId: z.string().min(1, "saleId wajib diisi").describe("ID baris investment_sales yang masih pending"),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
      }),
    },
    async ({ saleId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/investments/sales/${saleId}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
