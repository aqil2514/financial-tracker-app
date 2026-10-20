import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { dateField } from "@/lib/date-field";

// Port dari applyInvestmentBalanceCorrection (desktop, apps/desktop/src/
// shared/investments/apply-investment-balance-correction.ts) lewat Worker
// POST /investments/:accountId/correct-balance (apps/worker/src/modules/
// investments/service.ts correctInvestmentBalance) -- koreksi granular
// akun 'investment', BEDA dari correct_account_balance yang menolak TOTAL
// akun bertipe ini. BEDA dari write_off_investment: unit DAN pricePerUnit
// KEDUANYA manual di sini (prinsip "koreksi memaksa sistem sesuai
// kenyataan user saat ini") -- write-off selalu pakai average cost
// sistem, tool ini tidak.
export function registerCorrectInvestmentBalance(server: McpServer) {
  server.registerTool(
    "correct_investment_balance",
    {
      title: "Koreksi Saldo Investasi",
      description:
        "Koreksi saldo sebuah akun investasi ke unit+harga/cost per unit yang seharusnya, KEDUANYA manual (BUKAN average cost otomatis seperti write_off_investment). Gunakan ini bukan correct_account_balance kalau yang mau dikoreksi adalah akun bertipe 'investment' (saldo akun itu ditolak dikoreksi langsung karena derived dari riwayat pembelian/penjualan). unit adalah TOTAL unit yang SEHARUSNYA dimiliki sekarang (bukan selisih) -- arah tambah (beli) atau kurang (jual) ditentukan otomatis dari selisihnya dibanding sisa unit saat ini.",
      inputSchema: z.object({
        accountId: z.string().min(1, "Akun wajib diisi").describe("Akun bertipe 'investment'"),
        unit: z.number().min(0).describe("Total unit yang SEHARUSNYA dimiliki sekarang"),
        pricePerUnit: z.number().min(0).describe("Harga/cost per unit, manual untuk arah tambah maupun kurang"),
        date: dateField,
        note: z.string().describe("Alasan koreksi, mis. 'unit sebenarnya lebih banyak dari tercatat'"),
      }),
    },
    async ({ accountId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/investments/${accountId}/correct-balance`, {
        method: "POST",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
