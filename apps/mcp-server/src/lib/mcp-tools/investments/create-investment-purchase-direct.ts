import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { dateField } from "@/lib/date-field";

// Pola PERSIS create_debt_direct -- unit investasi bertambah TANPA
// transfer kas (hibah, bonus saham, right issue/warrant, atau saldo &
// unit awal sebelum pakai app). accountId wajib menunjuk akun bertipe
// 'investment'. Mode transfer (unit lahir dari transfer kas<->investment)
// SUDAH bisa lewat create_transaction -- tool ini KHUSUS jalur yang
// belum ada padanannya: unit bertambah tanpa kas berpindah sama sekali.
// Lihat docs/concept/konsep-investasi.md "Unit yang berubah TANPA
// transfer kas" dan Worker apps/worker/src/modules/investments/service.ts
// (createDirectInvestmentPurchase).
export function registerCreateInvestmentPurchaseDirect(server: McpServer) {
  server.registerTool(
    "create_investment_purchase_direct",
    {
      title: "Catat Pembelian Investasi Langsung",
      description:
        "Catat unit investasi BARU tanpa transfer kas apa pun -- untuk hibah, bonus saham, right issue/warrant tanpa modal tambahan, atau saldo & unit awal sebelum pakai app. accountId wajib menunjuk akun bertipe 'investment'. amount boleh 0 (hibah murni tanpa nilai yang mau diakui sebagai modal) atau nilai taksiran tertentu -- Worker membuat transaksi income sebesar amount pada akun investment itu sendiri. unit dan pricePerUnit WAJIB diisi (beda dari create_transaction arah beli yang opsional) supaya cost basis lot ini tidak pernah 0. Untuk unit yang lahir dari transfer kas->investment, gunakan create_transaction dengan type=transfer.",
      inputSchema: z.object({
        accountId: z.string().min(1, "Akun wajib diisi").describe("Akun bertipe 'investment'"),
        amount: z
          .number()
          .nonnegative()
          .describe("Nilai yang diakui sebagai modal (boleh 0 untuk hibah murni) -- tidak ada kas yang keluar"),
        unit: z.number().positive().describe("Jumlah unit yang diterima"),
        pricePerUnit: z.number().positive().describe("Harga per unit saat diterima -- wajib diisi, jadi cost basis lot ini"),
        date: dateField,
        note: z.string().optional(),
      }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/investments/purchases/direct", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
